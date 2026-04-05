//这个文件中加入了 COMMAND_MAP 字典来进行指令翻译，并引入了 ReadlineParser
const WebSocket = require("ws");
const { SerialPort, ReadlineParser } = require("serialport"); // 引入按行解析�?

// 1. 启动 WebSocket 服务�?
const wss = new WebSocket.Server({ port: 8080 });
console.log("WebSocket server running at ws://localhost:8080");

// 2. 打开 ESP32 串口
const port = new SerialPort({
  path: "COM4",   // 请确认这是否是你的真实串口名
  baudRate: 115200,
});

// �? 核心升级：增加按行读取器，防止串口数据断截，让网页显示整齐划一
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
let serialConnected = false

port.on("open", () => {
  serialConnected = true
  console.log("Serial connected to ESP32");
  if (currentClient && currentClient.readyState === WebSocket.OPEN) {
    currentClient.send(
      JSON.stringify({
        type: "status",
        status: { connection: "connected" }, //�����������ӳɹ�
        message: "Serial connected",
      }),
    )
  }
});

port.on("error", (err) => {
  serialConnected = false
  console.error("Serial error:", err.message);
  if (currentClient && currentClient.readyState === WebSocket.OPEN) {
    currentClient.send(
      JSON.stringify({
        type: "status",
        status: { connection: "error" },
        message: err.message,
      }),
    )
  }
});

let currentClient = null;

// �? 新增：指令翻译字�? (前端易读单词 -> 底层高效单字�?)
const COMMAND_MAP = {
  "UNLOCK": "U",
  "LOCK": "L",
  "FIXED_MOVE": "F",
  "TOGGLE_COORD": "K",
  "TEACH_START": "C",
  "RECORD_START": "A",
  "RECORD_END": "B",
  "CONFIRM": "Y",
  "CANCEL": "N",
  "AUTO_RUN": "V"
};

// 3. 浏览器连接到 Node
wss.on("connection", (ws) => {
  console.log("Frontend connected");
  currentClient = ws;

  ws.send(JSON.stringify({
    type: "status",
    status: { connection: serialConnected ? "connected" : "disconnected" },
    message: serialConnected ? "Serial connected" : "Serial disconnected",
  }));

  // 浏览器发消息 �? 转发�? ESP32
  ws.on("message", (message) => {
    const text = message.toString().trim();
    console.log("FROM FRONTEND:", text);

    // 核心翻译逻辑：如果在字典里，发单字符；如果不在，原样透传
    if (COMMAND_MAP[text]) {
      port.write(COMMAND_MAP[text]);
      console.log(`[网关翻译] ${text} -> ${COMMAND_MAP[text]} 发送给机械臂`);
    } else {
      port.write(text + "\r\n");
    }
  });

  ws.on("close", () => {
    console.log("Frontend disconnected");
    if (currentClient === ws) {
      currentClient = null;
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});

// 4. ESP32 串口消息 �? 转发给浏览器 (使用 parser 替代原先�? port.on('data'))
parser.on("data", (line) => {
  const text = line.trim(); // 清理多余的回车符
  if (text) {
    console.log("FROM ROBOT:", text);
    if (currentClient && currentClient.readyState === WebSocket.OPEN) {
      currentClient.send(JSON.stringify({
        type: "robot_serial",
        data: text,
      }));
    }
  }
});
