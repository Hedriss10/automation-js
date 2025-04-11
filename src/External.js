import ExecuteRo from "./bot/Ro.js";

function main(isRo = false, isMS = false) {
  if (isRo) {
    if (typeof ExecuteRo === "function") {
      ExecuteRo().catch((err) => console.error("Erro não tratado:", err));
    } else {
      console.error("Erro: ExecuteRo não é uma função");
    }
  } else if (isMS) {
    console.log("ExecuteMS não implementado ainda");
  }
}

main(true, false);
