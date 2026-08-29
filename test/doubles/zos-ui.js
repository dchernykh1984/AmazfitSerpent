// A stand-in for the Zepp OS UI module (@zos/ui), enough of it for the unit
// tests to build the page, look at what it drew and tap on it.
//
// Widgets are plain objects that remember the properties they were created with
// and the properties later written over them. A canvas is different: it keeps no
// scene graph on the watch either, so the double records the drawing calls in
// order and answers "what colour is this pixel" by replaying them.

export const widget = {
  FILL_RECT: "FILL_RECT",
  TEXT: "TEXT",
  BUTTON: "BUTTON",
  CANVAS: "CANVAS",
};

export const prop = { MORE: "MORE" };
export const align = { CENTER_H: "CENTER_H", CENTER_V: "CENTER_V" };
export const text_style = { NONE: "NONE" };
export const event = {
  CLICK_DOWN: "CLICK_DOWN",
  CLICK_UP: "CLICK_UP",
  MOVE: "MOVE",
};

// Everything currently on screen, in the order it was drawn.
export const screen = { widgets: [] };

export function reset() {
  screen.widgets = [];
}

export function createWidget(type, properties) {
  const created = {
    type,
    properties: Object.assign({}, properties),
    listeners: {},
    deleted: false,
    setProperty(name, values) {
      if (name !== prop.MORE) {
        throw new Error("unsupported property: " + name);
      }
      Object.assign(this.properties, values);
    },
    addEventListener(id, callback) {
      this.listeners[id] = callback;
    },
    // Delivers an event the way the watch would, and only to a widget that is
    // still on screen. `info` is what the runtime hands a canvas listener: the
    // point the finger landed on.
    fire(id, info) {
      if (this.deleted || !this.listeners[id]) {
        return false;
      }
      this.listeners[id](info);
      return true;
    },
    tap() {
      if (this.deleted) {
        return false;
      }
      if (this.type === widget.BUTTON && this.properties.click_func) {
        this.properties.click_func();
        return true;
      }
      return this.fire(event.CLICK_UP);
    },
  };
  if (type === widget.CANVAS) {
    addCanvas(created);
  }
  screen.widgets.push(created);
  return created;
}

function addCanvas(created) {
  created.commands = [];
  created.paint = {};
  created.setPaint = function (options) {
    Object.assign(this.paint, options);
  };
  created.drawRect = function (options) {
    this.commands.push(Object.assign({ op: "rect" }, options));
  };
  created.drawLine = function (options) {
    this.commands.push(Object.assign({ op: "line", width: this.paint.line_width }, options));
  };
  created.drawCircle = function (options) {
    this.commands.push(Object.assign({ op: "disc" }, options));
  };
  // A press and release at one point, which is how every control on the canvas
  // is worked.
  created.tapAt = function (x, y) {
    this.fire(event.CLICK_DOWN, { x, y });
    this.fire(event.CLICK_UP, { x, y });
  };
  // The lines currently visible inside a box: the ones drawn since the last time
  // that box was wiped. That is what "which icon is showing" comes down to when
  // the picture is an ordered list of draws.
  created.iconIn = function (box) {
    let lines = [];
    for (let i = 0; i < this.commands.length; i++) {
      const c = this.commands[i];
      const insideX = c.x1 >= box.x && c.x1 <= box.x + box.w;
      const insideY = c.y1 >= box.y && c.y1 <= box.y + box.h;
      if (!insideX || !insideY) {
        continue;
      }
      if (c.op === "rect" && c.x2 >= box.x + box.w && c.y2 >= box.y + box.h) {
        // A wipe covering the whole box clears whatever was drawn in it.
        lines = [];
      } else if (c.op === "line") {
        lines.push(c);
      }
    }
    return lines;
  };
}

export function deleteWidget(target) {
  target.deleted = true;
  const index = screen.widgets.indexOf(target);
  if (index >= 0) {
    screen.widgets.splice(index, 1);
  }
}
