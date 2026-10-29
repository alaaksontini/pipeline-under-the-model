/** Union-find over product ids for fuzzy dedupe grouping. */
export class Clusters {
  private parent = new Map<string, string>();

  find(x: string): string {
    let r = x;
    while (this.parent.get(r) !== undefined && this.parent.get(r) !== r) r = this.parent.get(r)!;
    this.parent.set(x, r);
    return r;
  }

  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  groups(): Map<string, string[]> {
    const g = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const r = this.find(id);
      g.set(r, [...(g.get(r) ?? []), id]);
    }
    return g;
  }
}
