export class Registry<T> {
  private map = new Map<string, T>();

  public register(id: string, entry: T): void {
    this.map.set(id, entry);
  }

  public get(id: string): T | undefined {
    return this.map.get(id);
  }

  public getAll(): T[] {
    return Array.from(this.map.values());
  }

  public has(id: string): boolean {
    return this.map.has(id);
  }

  public unregister(id: string): boolean {
    return this.map.delete(id);
  }

  public clear(): void {
    this.map.clear();
  }
}
