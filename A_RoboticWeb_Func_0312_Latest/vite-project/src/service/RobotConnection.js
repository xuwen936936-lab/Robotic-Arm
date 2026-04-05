let socket = null;

export function connectRobot(onMessage, onStatus) {
  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    console.log("Connected to Node gateway");
    if (onStatus) onStatus("Connected");
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("FROM NODE:", msg);

    if (onMessage) onMessage(msg);
  };

  socket.onerror = (error) => {
    console.log("Connection error:", error);
    if (onStatus) onStatus("Error");
  };

  socket.onclose = () => {
    console.log("Connection closed");
    if (onStatus) onStatus("Disconnected");
  };
}

export function sendCommand(cmd) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(cmd);
  } else {
    console.log("Socket not connected");
  }
}