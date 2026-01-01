


class EventBus {
  constructor() {
    this.events = {};
  }


  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }


  off(eventName, listener) {
    if (!this.events[eventName]) return;

    const index = this.events[eventName].indexOf(listener);
    if (index > -1) {
      this.events[eventName].splice(index, 1);
    }
  }


  emit(eventName, ...args) {
    if (!this.events[eventName]) return;


    this.events[eventName].forEach((listener) => {
      listener(...args);
    });
  }
}


export const eventBus = new EventBus();
