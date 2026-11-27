export async function waitFor(read, ready, {
  retries = 20,
  pause = () => new Promise((done) => setTimeout(done, 25)),
} = {}) {
  let value = await read();
  for (let i = 0; i < retries && !ready(value); i += 1) {
    await pause();
    value = await read();
  }
  return value;
}
