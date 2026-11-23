export function createKeyedLock() {
  const queues = new Map<string, Promise<unknown>>();

  return function withLock<Result>(key: string, run: () => Promise<Result>): Promise<Result> {
    const current = (queues.get(key) ?? Promise.resolve()).then(run);
    const tail = current.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    return current;
  };
}
