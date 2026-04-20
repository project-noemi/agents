export class StateManager {
  constructor() {
    this.state = new Map();
  }
  
  get(key) {
    return this.state.get(key);
  }
  
  set(key, value) {
    this.state.set(key, value);
  }
}
