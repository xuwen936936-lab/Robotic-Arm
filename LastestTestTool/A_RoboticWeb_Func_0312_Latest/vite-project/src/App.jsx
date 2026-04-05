// import { useState, useRef, useEffect } from "react";
// import { connectRobot, sendCommand } from "./service/RobotConnection";

// function App() {
//   const [status, setStatus] = useState("Not connected");
//   const [messages, setMessages] = useState([]);
//   const logEndRef = useRef(null);

//   // === 🚀 新增：专门用于仪表盘展示的状态变量 ===
//   const [coords, setCoords] = useState({ x: "0.0", y: "0.0", z: "0.0", pitch: "0.0" });
//   const [startServos, setStartServos] = useState(["-", "-", "-", "-", "-"]);
//   const [endServos, setEndServos] = useState(["-", "-", "-", "-", "-"]);
  
//   // 用于暂存最新收到的一行串口数据，用来触发正则解析
//   const [lastMessage, setLastMessage] = useState("");
//   // 用于标记当前正在录制的是起点(A)还是终点(B)
//   const recordingTargetRef = useRef(null); 

//   // 1. 自动滚动控制台到底部
//   useEffect(() => {
//     logEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   // 2. ⚡ 核心魔法：使用正则解析串口发来的每一句话，提取坐标和舵机数据
//   useEffect(() => {
//     if (!lastMessage) return;
//     const text = lastMessage;

//     // 魔法 A：提取 XYZ 坐标 (适配 "X: 200.0 mm | Y: ... mm | Z: ... mm | 俯仰角: ... 度")
//     const coordMatch = text.match(/X:\s*([-\d.]+)\s*mm\s*\|\s*Y:\s*([-\d.]+)\s*mm\s*\|\s*Z:\s*([-\d.]+)\s*mm\s*\|\s*(?:末端)?俯仰角:\s*([-\d.]+)\s*度/);
//     if (coordMatch) {
//       setCoords({
//         x: coordMatch[1],
//         y: coordMatch[2],
//         z: coordMatch[3],
//         pitch: coordMatch[4]
//       });
//     }

//     // 魔法 B：提取 5 个舵机数值 (适配 "关节0=1500  关节1=1500 ...")
//     if (text.includes("关节0=")) {
//       const parsedServos = [];
//       for (let i = 0; i < 5; i++) {
//         // 动态生成正则寻找每一个舵机的数字
//         const match = text.match(new RegExp(`关节${i}=([\\d]+)`));
//         parsedServos.push(match ? match[1] : "-");
//       }
      
//       // 判断当前是在记录起点还是终点，存入对应的展示框
//       if (recordingTargetRef.current === "A") {
//         setStartServos(parsedServos);
//       } else if (recordingTargetRef.current === "B") {
//         setEndServos(parsedServos);
//       }
//     }
//   }, [lastMessage]);

//   // 3. 建立连接并接收数据
//   function handleConnect() {
//     connectRobot(
//       (msg) => {
//         if (msg.type === "robot_serial") {
//           const text = msg.data;
//           setMessages((prev) => [...prev, text].slice(-50));
//           setLastMessage(text); // 触发上面的正则解析器
//         } else if (msg.type === "status") {
//           setMessages((prev) => [...prev, `[系统] ${msg.message}`].slice(-50));
//         }
//       },
//       (newStatus) => setStatus(newStatus)
//     );
//   }

//   // 4. 发送指令函数
//   const sendAction = (cmdWord, target = null) => {
//     // 如果传入了目标(A或B)，就先记录下来，方便等会回传数据时归类
//     if (target) recordingTargetRef.current = target;
    
//     sendCommand(cmdWord);
//     setMessages((prev) => [...prev, `👉 [网页下发指令] : ${cmdWord}`].slice(-50));
//   };

//   return (
//     <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
//       <h1 style={{ textAlign: "center", marginBottom: "10px" }}>🤖 机械臂 Web 数字孪生控制台</h1>

//       <div style={{ marginBottom: "20px", textAlign: "center" }}>
//         <strong style={{ color: status === "Connected" ? "green" : "red", marginRight: "15px", fontSize: "16px" }}>
//           状态: {status}
//         </strong>
//         <button onClick={handleConnect} style={{ padding: "8px 16px", cursor: "pointer", fontSize: "16px", background:"#1890ff", color:"white", border:"none", borderRadius:"4px" }}>
//           🔌 连接机器人网关
//         </button>
//       </div>

//       {/* ================== 📊 核心数据仪表盘区 ================== */}
//       <div style={{ display: "flex", gap: "20px", marginBottom: "25px", flexWrap: "wrap" }}>
//         {/* 坐标显示卡片 */}
//         <div style={{ flex: "1 1 45%", background: "#f0f5ff", padding: "15px 20px", borderRadius: "8px", border: "1px solid #adc6ff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
//           <h3 style={{ margin: "0 0 15px 0", color: "#1d39c4", display: "flex", alignItems: "center" }}>
//             <span style={{ fontSize: "24px", marginRight: "8px" }}>📍</span> 实时空间坐标
//           </h3>
//           <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", fontFamily: "monospace", color: "#0050b3" }}>
//             <span>X: {coords.x}</span>
//             <span>Y: {coords.y}</span>
//             <span>Z: {coords.z}</span>
//             <span>俯仰: {coords.pitch}°</span>
//           </div>
//         </div>
        
//         {/* 示教记录卡片 */}
//         <div style={{ flex: "1 1 45%", background: "#f6ffed", padding: "15px 20px", borderRadius: "8px", border: "1px solid #b7eb8f", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
//           <h3 style={{ margin: "0 0 10px 0", color: "#389e0d", display: "flex", alignItems: "center" }}>
//              <span style={{ fontSize: "24px", marginRight: "8px" }}>📐</span> 示教记录数据
//           </h3>
//           <div style={{ fontSize: "15px", fontFamily: "monospace", color: "#237804" }}>
//             <div style={{ marginBottom: "8px", background:"#fff", padding:"4px 8px", borderRadius:"4px", border:"1px dashed #d9d9d9" }}>
//               <strong>起点 (A):</strong> [ {startServos.join(', ')} ]
//             </div>
//             <div style={{ background:"#fff", padding:"4px 8px", borderRadius:"4px", border:"1px dashed #d9d9d9" }}>
//               <strong>终点 (B):</strong> [ {endServos.join(', ')} ]
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* ================== 🎮 控制面板区 ================== */}
//       <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "space-between" }}>
        
//         {/* 1. 基础力矩控制区 */}
//         <div style={{ border: "1px solid #e8e8e8", padding: "15px", borderRadius: "8px", flex: "1 1 30%", background:"#fafafa" }}>
//           <h3 style={{ marginTop: 0 }}>💪 基础控制</h3>
//           <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
//             <button onClick={() => sendAction("UNLOCK")} style={btnStyle}>一键卸力</button>
//             <button onClick={() => sendAction("LOCK")} style={{...btnStyle, color:"white", background:"#595959", borderColor:"#595959"}}>一键上电锁定</button>
//           </div>
//         </div>

//         {/* 2. 高级功能区 */}
//         <div style={{ border: "1px solid #e8e8e8", padding: "15px", borderRadius: "8px", flex: "1 1 30%", background:"#fafafa" }}>
//           <h3 style={{ marginTop: 0 }}>✨ 高级功能</h3>
//           <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
//             <button onClick={() => sendAction("FIXED_MOVE")} style={{...btnStyle, backgroundColor: "#e6f7ff", borderColor: "#91d5ff", color: "#096dd9"}}>
//               电磁铁定点抓放
//             </button>
//             <button onClick={() => sendAction("TOGGLE_COORD")} style={{...btnStyle, backgroundColor: "#fffbe6", borderColor: "#ffe58f", color: "#d46b08"}}>
//               开关实时坐标计算 (K)
//             </button>
//           </div>
//         </div>

//         {/* 3. 示教记录区 */}
//         <div style={{ border: "1px solid #e8e8e8", padding: "15px", borderRadius: "8px", flex: "1 1 100%", background:"#fafafa" }}>
//           <h3 style={{ marginTop: 0 }}>🎓 示教记录模式</h3>
//           <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
//             <button onClick={() => sendAction("TEACH_START")} style={{...btnStyle, flex: 1}}>1. 开始示教</button>
//             {/* 注意这里：传入了额外的 "A" 和 "B" 参数，告诉底层我们要记录什么数据 */}
//             <button onClick={() => sendAction("RECORD_START", "A")} style={{...btnStyle, flex: 1}}>2. 记录起点</button>
//             <button onClick={() => sendAction("RECORD_END", "B")} style={{...btnStyle, flex: 1}}>3. 记录终点</button>
//           </div>
//           <div style={{ display: "flex", gap: "10px" }}>
//             <button onClick={() => sendAction("CONFIRM")} style={{...btnStyle, flex: 1, backgroundColor: "#f6ffed", borderColor: "#b7eb8f", color: "#389e0d"}}>
//               ✅ 确认当前记录
//             </button>
//             <button onClick={() => sendAction("CANCEL")} style={{...btnStyle, flex: 1, backgroundColor: "#fff1f0", borderColor: "#ffa39e", color: "#cf1322"}}>
//               ❌ 取消/全盘重置
//             </button>
//             <button onClick={() => sendAction("AUTO_RUN")} style={{...btnStyle, flex: 1, backgroundColor: "#f9f0ff", borderColor: "#d3adf7", color: "#531dab"}}>
//               ▶️ 自动运行该轨迹
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* ================== 🖥️ 串口日志区 ================== */}
//       <div style={{ marginTop: "25px" }}>
//         <h3 style={{ marginBottom: "8px" }}>🖥️ 原始串口控制台:</h3>
//         <div style={{
//           background: "#1e1e1e", color: "#00ff00", padding: "15px", 
//           height: "300px", overflowY: "auto", borderRadius: "8px",
//           fontFamily: "monospace", fontSize: "14px", display: "flex", flexDirection: "column", gap: "4px"
//         }}>
//           {messages.length === 0 ? "暂无数据..." : messages.map((m, i) => (
//              <div key={i} style={{ wordWrap: "break-word" }}>{m}</div>
//           ))}
//           <div ref={logEndRef} />
//         </div>
//       </div>
//     </div>
//   );
// }

// const btnStyle = {
//   padding: "10px",
//   cursor: "pointer",
//   borderRadius: "5px",
//   border: "1px solid #d9d9d9",
//   background: "#ffffff",
//   fontSize: "14px",
//   fontWeight: "bold",
//   transition: "all 0.2s"
// };

// export default App;

import { useState, useRef, useEffect } from "react";
import { connectRobot, sendCommand } from "./service/RobotConnection";

function App() {
  const [status, setStatus] = useState("Not connected");
  const [messages, setMessages] = useState([]);
  const logEndRef = useRef(null);

  const [coords, setCoords] = useState({ x: "0.0", y: "0.0", z: "0.0", pitch: "0.0" });
  const [startServos, setStartServos] = useState(["-", "-", "-", "-", "-"]);
  const [endServos, setEndServos] = useState(["-", "-", "-", "-", "-"]);
  
  const [lastMessage, setLastMessage] = useState("");
  const recordingTargetRef = useRef(null); 

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Regex parser updated for English output from Arduino
  useEffect(() => {
    if (!lastMessage) return;
    const text = lastMessage;

    // Matches: X: 200.0 mm | Y: 150.0 mm | Z: 100.0 mm | Pitch: 0.0 deg
    const coordMatch = text.match(/X:\s*([-\d.]+)\s*mm\s*\|\s*Y:\s*([-\d.]+)\s*mm\s*\|\s*Z:\s*([-\d.]+)\s*mm\s*\|\s*Pitch:\s*([-\d.]+)\s*deg/);
    if (coordMatch) {
      setCoords({
        x: coordMatch[1],
        y: coordMatch[2],
        z: coordMatch[3],
        pitch: coordMatch[4]
      });
    }

    // Matches: Joint0=1500
    if (text.includes("Joint0=")) {
      const parsedServos = [];
      for (let i = 0; i < 5; i++) {
        const match = text.match(new RegExp(`Joint${i}=([\\d]+)`));
        parsedServos.push(match ? match[1] : "-");
      }
      
      if (recordingTargetRef.current === "A") {
        setStartServos(parsedServos);
      } else if (recordingTargetRef.current === "B") {
        setEndServos(parsedServos);
      }
    }
  }, [lastMessage]);

  function handleConnect() {
    connectRobot(
      (msg) => {
        if (msg.type === "robot_serial") {
          const text = msg.data;
          setMessages((prev) => [...prev, text].slice(-50));
          setLastMessage(text);
        } else if (msg.type === "status") {
          setMessages((prev) => [...prev, `[System] ${msg.message}`].slice(-50));
        }
      },
      (newStatus) => setStatus(newStatus)
    );
  }

  const sendAction = (cmdWord, target = null) => {
    if (target) recordingTargetRef.current = target;
    sendCommand(cmdWord);
    setMessages((prev) => [...prev, `👉 [Web Command] : ${cmdWord}`].slice(-50));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "10px" }}>🤖 Robotic Arm Control Panel</h1>

      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <strong style={{ color: status === "Connected" ? "green" : "red", marginRight: "15px", fontSize: "16px" }}>
          Status: {status}
        </strong>
        <button onClick={handleConnect} style={{ padding: "8px 16px", cursor: "pointer", fontSize: "16px", background:"#1890ff", color:"white", border:"none", borderRadius:"4px" }}>
          🔌 Connect Gateway
        </button>
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "25px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 45%", background: "#f0f5ff", padding: "15px 20px", borderRadius: "8px", border: "1px solid #adc6ff" }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#1d39c4" }}>📍 Real-time Coordinates</h3>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", fontFamily: "monospace", color: "#0050b3" }}>
            <span>X: {coords.x}</span>
            <span>Y: {coords.y}</span>
            <span>Z: {coords.z}</span>
            <span>Pitch: {coords.pitch}°</span>
          </div>
        </div>
        
        <div style={{ flex: "1 1 45%", background: "#f6ffed", padding: "15px 20px", borderRadius: "8px", border: "1px solid #b7eb8f" }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#389e0d" }}>📐 Teach & Record Data</h3>
          <div style={{ fontSize: "15px", fontFamily: "monospace", color: "#237804" }}>
            <div style={{ marginBottom: "8px", background:"#fff", padding:"4px 8px", borderRadius:"4px", border:"1px dashed #d9d9d9" }}>
              <strong>START (A):</strong> [ {startServos.join(', ')} ]
            </div>
            <div style={{ background:"#fff", padding:"4px 8px", borderRadius:"4px", border:"1px dashed #d9d9d9" }}>
              <strong>END (B):</strong> [ {endServos.join(', ')} ]
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ border: "1px solid #e8e8e8", padding: "15px", borderRadius: "8px", flex: "1 1 30%", background:"#fafafa" }}>
          <h3 style={{ marginTop: 0 }}>💪 Basic Control</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => sendAction("UNLOCK")} style={btnStyle}>Unlock (Free Move)</button>
            <button onClick={() => sendAction("LOCK")} style={{...btnStyle, color:"white", background:"#595959", borderColor:"#595959"}}>Lock (Hold Pos)</button>
          </div>
        </div>

        <div style={{ border: "1px solid #e8e8e8", padding: "15px", borderRadius: "8px", flex: "1 1 30%", background:"#fafafa" }}>
          <h3 style={{ marginTop: 0 }}>✨ Advanced</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => sendAction("FIXED_MOVE")} style={{...btnStyle, backgroundColor: "#e6f7ff", borderColor: "#91d5ff", color: "#096dd9"}}>
              Magnet Pick & Place
            </button>
            <button onClick={() => sendAction("TOGGLE_COORD")} style={{...btnStyle, backgroundColor: "#fffbe6", borderColor: "#ffe58f", color: "#d46b08"}}>
              Toggle Coordinates (K)
            </button>
          </div>
        </div>

        <div style={{ border: "1px solid #e8e8e8", padding: "15px", borderRadius: "8px", flex: "1 1 100%", background:"#fafafa" }}>
          <h3 style={{ marginTop: 0 }}>🎓 Teach & Record</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <button onClick={() => sendAction("TEACH_START")} style={{...btnStyle, flex: 1}}>1. Start Teaching</button>
            <button onClick={() => sendAction("RECORD_START", "A")} style={{...btnStyle, flex: 1}}>2. Record START</button>
            <button onClick={() => sendAction("RECORD_END", "B")} style={{...btnStyle, flex: 1}}>3. Record END</button>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => sendAction("CONFIRM")} style={{...btnStyle, flex: 1, backgroundColor: "#f6ffed", borderColor: "#b7eb8f", color: "#389e0d"}}>
              ✅ Confirm Record
            </button>
            <button onClick={() => sendAction("CANCEL")} style={{...btnStyle, flex: 1, backgroundColor: "#fff1f0", borderColor: "#ffa39e", color: "#cf1322"}}>
              ❌ Cancel / Reset
            </button>
            <button onClick={() => sendAction("AUTO_RUN")} style={{...btnStyle, flex: 1, backgroundColor: "#f9f0ff", borderColor: "#d3adf7", color: "#531dab"}}>
              ▶️ Auto Run Trajectory
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "25px" }}>
        <h3 style={{ marginBottom: "8px" }}>🖥️ Serial Console Log:</h3>
        <div style={{
          background: "#1e1e1e", color: "#00ff00", padding: "15px", 
          height: "300px", overflowY: "auto", borderRadius: "8px",
          fontFamily: "monospace", fontSize: "14px", display: "flex", flexDirection: "column", gap: "4px"
        }}>
          {messages.length === 0 ? "No data yet..." : messages.map((m, i) => (
             <div key={i} style={{ wordWrap: "break-word" }}>{m}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "10px", cursor: "pointer", borderRadius: "5px", border: "1px solid #d9d9d9",
  background: "#ffffff", fontSize: "14px", fontWeight: "bold", transition: "all 0.2s"
};

export default App;
