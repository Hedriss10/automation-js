import executeRo from "./bot/Ro.js";

function main(isRo = false, isMS = false) {
  if (isRo) {
    if (typeof executeRo === "function") {
      executeRo().catch((err) => console.error("Erro não tratado:", err));
    } else {
      console.error("Erro: executeRo não é uma função");
    }
  } else if (isMS) {
    console.log("ExecuteMS não implementado ainda");
  }
}

main(true, false);
