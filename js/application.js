// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  new GameManager(4, Agent, HTMLActuator, LocalStorageManager);
});
