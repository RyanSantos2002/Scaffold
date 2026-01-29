const fs = require("fs");
const path = require("path");
const http = require("http");

// Load config
const configPath = path.resolve(__dirname, "capture", "@Config", "index.js");
if (!fs.existsSync(configPath)) {
  console.error("Config not found at " + configPath);
  process.exit(1);
}
const config = require(configPath);

// Locate JSON
// ../output/json/{config.tela}/{config.tela}.json (agora está fora da pasta html-capture)
const jsonPath = path.resolve(
  __dirname,
  "..",
  "output",
  "json",
  config.tela,
  `${config.tela}.json`,
);

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON file not found at ${jsonPath}. Run /gerar-json first.`);
  process.exit(1);
}

const jsonData = fs.readFileSync(jsonPath, "utf8");

// Prepare POST
const postData = jsonData;

const options = {
  hostname: "localhost",
  port: 3333,
  path: "/scaffold",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

const MAX_RETRIES = 30;
let attempts = 0;

function sendRequest() {
  attempts++;
  console.log(
    `[Attempt ${attempts}/${MAX_RETRIES}] Sending JSON to http://localhost:3333/scaffold...`,
  );

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding("utf8");
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log(`BODY: ${body}`);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log("SUCCESS!");
        process.exit(0);
      } else {
        console.error("FAILED Request (Status Code)");
        process.exit(1);
      }
    });
  });

  req.on("error", (e) => {
    if (attempts < MAX_RETRIES) {
      console.log(`Server not ready... retrying in 2s (${e.message})`);
      setTimeout(sendRequest, 2000);
    } else {
      console.error(`PROBLEM with request: ${e.message}`);
      console.error(
        "Make sure the scaffolding server is running (npm run dev).",
      );
      process.exit(1);
    }
  });

  req.write(postData);
  req.end();
}

sendRequest();
