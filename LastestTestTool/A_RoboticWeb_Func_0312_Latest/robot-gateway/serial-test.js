const { SerialPort } = require("serialport");

const port = new SerialPort({
  path: "/dev/cu.usbserial-1120",   // 改成你的真实串口
  baudRate: 115200,
});

port.on("open", () => {
  console.log("Serial connected");

  setTimeout(() => {
    console.log("Send: $PING!");
    port.write("$PING!\r\n");
  }, 2000);
});

port.on("data", (data) => {
  console.log("RAW FROM ROBOT:", data.toString());
});

port.on("error", (err) => {
  console.error("Serial error:", err.message);
});