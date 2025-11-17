import "./style.css";

// ================== 状态变量 ==================
let currentStage = 0;
let isRunning = false;
let currentTimer = null;
let positiveTime = 17 * 60;
let negativeTime = 17 * 60;
let lastUserSpeech = "";

// ================== 辩论赛阶段 ==================
const stages = [
  "准备中",
  "正方一辩陈词",
  "反方四辩质询",
  "反方一辩陈词",
  "正方四辩质询",
  "正方二辩陈词",
  "反方三辩质询",
  "反方二辩陈词",
  "正方三辩质询",
  "反方三辩小结",
  "正方三辩小结",
  "自由辩论",
  "反方总结",
  "正方总结",
];

// ================== DOM 引用 ==================
const statusHeader = document.getElementById("status");
const positiveTimerEl = document.getElementById("positiveTime");
const negativeTimerEl = document.getElementById("negativeTime");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const nextBtn = document.getElementById("nextStep");
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const asrText = document.querySelector("#asrText span");
const aiOutput = document.getElementById("aiOutput");
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKey");

// ================== 通用函数 ==================
function getCurrentSide() {
  const s = stages[currentStage];
  if (s.includes("正方")) return "positive";
  if (s.includes("反方")) return "negative";
  return null;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function updateStatus() {
  const s = stages[currentStage];
  statusHeader.textContent = "当前阶段：" + s;
  if (getCurrentSide() === "positive") {
    statusHeader.style.color = "#1a73e8";
  } else if (getCurrentSide() === "negative") {
    statusHeader.style.color = "#e53935";
  } else {
    statusHeader.style.color = "#333";
  }
}

function updateTimers() {
  positiveTimerEl.textContent = formatTime(positiveTime);
  negativeTimerEl.textContent = formatTime(negativeTime);
}

updateStatus();
updateTimers();

// ================== 计时逻辑 ==================
function startTimer(side) {
  if (isRunning) return;
  isRunning = true;
  currentTimer = setInterval(() => {
    if (side === "positive") {
      positiveTime--;
      if (positiveTime <= 0) {
        clearInterval(currentTimer);
        isRunning = false;
        alert("正方时间用尽！");
      }
    } else if (side === "negative") {
      negativeTime--;
      if (negativeTime <= 0) {
        clearInterval(currentTimer);
        isRunning = false;
        alert("反方时间用尽！");
      }
    }
    updateTimers();
  }, 1000);
}

function pauseTimer() {
  clearInterval(currentTimer);
  isRunning = false;
}

function resumeTimer() {
  const side = getCurrentSide();
  if (!side) return alert("当前阶段不是有效发言阶段。");
  startTimer(side);
}

// ================== ASR ==================
let recognition = null;
let recognizing = false;

recordBtn.onclick = () => {
  if (!("webkitSpeechRecognition" in window)) {
    alert("当前浏览器不支持语音识别，请使用 Chrome。");
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    recognizing = true;
    asrText.textContent = "🎤 正在聆听...";
  };

  recognition.onerror = (e) => {
    recognizing = false;
    asrText.textContent = "识别出错：" + e.error;
  };

  recognition.onend = () => {
    recognizing = false;
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    asrText.textContent = text;
    lastUserSpeech = text;
  };

  recognition.start();
};

stopBtn.onclick = () => {
  if (recognition && recognizing) {
    recognition.stop();
    recognizing = false;
    asrText.textContent += " (已停止)";
  } else {
    alert("未在录音状态");
  }
};

// ================== API Key ==================
function getApiKey() {
  return sessionStorage.getItem("API_KEY");
}

saveKeyBtn.onclick = () => {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith("sk-")) {
    alert("请输入以 sk- 开头的 DashScope API Key");
    return;
  }
  sessionStorage.setItem("API_KEY", key);
  alert("API Key 已保存");
};

// ================== AI生成逻辑 ==================
async function generateAIReply(userText) {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("请先输入有效 API Key！");
    return;
  }

  aiOutput.textContent = "AI 正在思考中...";

  try {
    const phase = stages[currentStage];
    const side = getCurrentSide();
    const aiCamp = side === "positive" ? "正方" : side === "negative" ? "反方" : "辩论AI";

    // 阶段类型识别
    const isQuestion = /质询/.test(phase);
    const isStatement = /陈词/.test(phase);
    const isSummary = /小结|总结/.test(phase);
    const isFree = /自由/.test(phase);

    let systemInstruction = "";
    if (isQuestion) {
      systemInstruction = `你现在是${aiCamp}的辩手，处在“${phase}”阶段。请基于用户上一阶段的发言，进行有逻辑、有针对性的质询和反驳，提出问题或反例，语气简洁犀利。`;
    } else if (isStatement) {
      systemInstruction = `你现在是${aiCamp}的辩手，处在“${phase}”阶段。请系统性阐述本方立场，不反驳自己，只需从论据、逻辑、例证角度强化己方观点。`;
    } else if (isSummary) {
      systemInstruction = `你现在处在“${phase}”阶段，应总结本方主要论点，重申立场要点，并回应对方主要质询。`;
    } else if (isFree) {
      systemInstruction = `你现在处在自由辩论阶段，请以快速反击的方式回应对方观点，简短有力。`;
    } else {
      systemInstruction = `你是本场辩论的${aiCamp}，请根据阶段自由陈述。`;
    }

    const res = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages: [
            {
              role: "system",
              content:
                `你是一名专业的中文辩论AI，请遵循中国大学生辩论赛逻辑进行发言。` +
                `规则：\n1. 质询阶段 → 针对对方（用户）上阶段反驳。\n2. 陈词/小结/总结 → 强化己方立场，不反驳自己。\n3. 自由辩论 → 简短针对性反击。\n` +
                systemInstruction,
            },
            {
              role: "user",
              content: `上一阶段用户发言：${userText || "（无用户发言）"}。\n当前阶段：${phase}`,
            },
          ],
        }),
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const output =
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      "（AI没有返回结果）";

    aiOutput.textContent = output;
    playTTS(output);
  } catch (err) {
    console.error("AI出错：", err);
    aiOutput.textContent = "AI出错：" + err.message;
  }
}

// ================== TTS ==================
function playTTS(text) {
  if (!("speechSynthesis" in window)) {
    aiOutput.textContent += "\n（浏览器不支持TTS）";
    return;
  }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "zh-CN";
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.includes("zh"));
  if (zhVoice) speech.voice = zhVoice;
  window.speechSynthesis.speak(speech);
}

// ================== 比赛控制 ==================
startBtn.onclick = () => {
  currentStage = 1;
  updateStatus();
  const side = getCurrentSide();
  alert("比赛开始：" + stages[currentStage]);
  if (side) startTimer(side);
};


nextBtn.onclick = async () => {
  pauseTimer();

  currentStage++;
  if (currentStage >= stages.length) {
    alert("辩论已全部结束。");
    return;
  }
  updateStatus();

  const side = getCurrentSide();
  const stageName = stages[currentStage];
  alert("进入：" + stageName);

  if (side) startTimer(side);

  if (side === "negative") {
    aiOutput.textContent = "AI正在思考...";
    await generateAIReply(lastUserSpeech);
  } else if (side === "positive") {
    aiOutput.textContent = "请正方开始发言。";
  } else {
    aiOutput.textContent = "（当前阶段无需发言）";
  }
};

pauseBtn.onclick = pauseTimer;
resumeBtn.onclick = resumeTimer;