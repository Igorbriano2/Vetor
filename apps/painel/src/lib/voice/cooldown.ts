// Evita disparo duplicado da mesma detecção de wake word (ex: o mesmo
// "vetor" aparecendo em vários resultados intermediários de reconhecimento,
// ou dois frames de classificador seguidos passando do limiar). Pura,
// compartilhada entre browserSpeechEngine e openWakeWordEngine.
export function passouCooldown(ultimaDeteccaoMs: number, agoraMs: number, cooldownMs: number): boolean {
  return agoraMs - ultimaDeteccaoMs >= cooldownMs;
}
