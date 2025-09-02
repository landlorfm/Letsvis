export class SelectionManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.selections = new Set();
    this.init();
  }

  init() {
    this.renderer.canvas.addEventListener('click', (e) => {
      if (e.shiftKey) {
        this.addToSelection(this.renderer.hoveredBlock);
      } else {
        this.toggleSelection(this.renderer.hoveredBlock);
      }
    });
  }

  toggleSelection(block) {
    if (!block) return;
    
    const id = this.getBlockId(block);
    if (this.selections.has(id)) {
      this.selections.delete(id);
    } else {
      this.selections.add(id);
    }
    
    this.renderer.render(this.renderer.lastData);
  }
}