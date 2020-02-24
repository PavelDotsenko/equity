const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");
const dayjs = require("dayjs")
const base64Img = require("base64-img");

registerFont(path.resolve(process.cwd(), "fonts/Roboto-Regular.ttf"), {
  family: "Roboto"
});

const canvas = createCanvas(1000, 770);
const ctx = canvas.getContext("2d");

const actions = {
  closeShort: "Close Short",
  short: "Short",
  long: "Long",
  closeLong: "Close Long",
  stop: "Stop"
};

const actionColors = {
  closeShort: "#BD3656",
  short: "#BD3656",
  long: "#1CA46B",
  closeLong: "#1CA46B"
};

const arrows = {
  closeShort: "red_up",
  short: "red_down",
  long: "green_up",
  closeLong: "green_down"
};

function setFontSize(fontSize) {
  return `${fontSize}px 'Roboto', 'Ubuntu', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif`;
}

function setText(text, params) {
  const x = params.x || 0;
  const y = params.y || 0;
  const color = params.color || "#FFFFFF";
  const textAlign = params.textAlign || "start";
  const fontSize = params.fontSize || 58;
  const bold = params.bold || false;
  const fontWeight = bold ? "bold" : "normal";

  ctx.font = `${fontWeight} ${setFontSize(fontSize)}`;
  ctx.fillStyle = color;
  ctx.textAlign = textAlign;
  ctx.fillText(text, x, y + fontSize);

  return ctx.measureText(text).width;
}

function setAction(text, x, y, callback = () => {}) {
  const action = actions[text];
  const arrow = arrows[text];
  const width = setText(action, {
    x: x,
    y: y,
    fontSize: 64,
    color: actionColors[text]
  });

  loadImage(`img/${arrow}.png`).then(image => {
    ctx.drawImage(image, x + width + 20, y + 20, 33, 44);

    callback();
  });
}

module.exports.signal = async function(robot, signal) {
  const price = `${signal.price} $`;
  const orderType = actions[signal.orderType];

  loadImage("../background.png").then(image => {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const signalDate = dayjs(signal.timestamp).format("DD MMM HH:mm UTC");

    setText("Signal", { x: 40, y: 40 });
    setText(signalDate, {
      x: canvas.width - 60,
      y: 40,
      textAlign: "end",
      color: "#6987B9"
    });
    setText(robot.name, { x: 40, y: 186, fontSize: 64 });
    setText("Position", { x: 40, y: 316, color: "#6987B9" });
    setText(signal.code, { x: 280, y: 308, fontSize: 66 });
    setText("Action", { x: 40, y: 475, color: "#6987B9" });
    setText(orderType, {
      x: canvas.width - 80,
      y: 468,
      fontSize: 64,
      textAlign: "end"
    });
    setText("Price", { x: 40, y: canvas.height - 120, color: "#6987B9" });
    setText(price, { x: 280, y: canvas.height - 128, fontSize: 66 });
    setAction(signal.action, 280, 468, () => {
      const fileName = signal.code + "_" + signalDate.replace(/ /g, "_");

      base64Img.img(canvas.toDataURL(), "dest", fileName, function(
        err,
        filepath
      ) {});
    });
  });
};
