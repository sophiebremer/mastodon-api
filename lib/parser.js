"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _events = require("events");
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }
function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }
function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }
function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }
function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }
function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }
function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }
var Parser = /*#__PURE__*/function (_EventEmitter) {
  _inherits(Parser, _EventEmitter);
  var _super = _createSuper(Parser);
  function Parser() {
    var _this;
    _classCallCheck(this, Parser);
    _this = _super.call(this);
    _this.message = '';
    return _this;
  }
  _createClass(Parser, [{
    key: "parse",
    value: function parse(chunk) {
      // skip heartbeats
      if (chunk === ':thump\n') {
        this.emit('heartbeat', {});
        return;
      }
      this.message += chunk;
      chunk = this.message;
      var size = chunk.length;
      var start = 0;
      var offset = 0;
      var curr;
      var next;
      while (offset < size) {
        curr = chunk[offset];
        next = chunk[offset + 1];
        if (curr === '\n' && next === '\n') {
          var piece = chunk.slice(start, offset);
          offset += 2;
          start = offset;

          /* eslint-disable no-continue */
          if (!piece.length) continue; // empty object

          var root = piece.split('\n');

          // should never happen, as long as mastodon doesn't change API messages
          if (root.length !== 2) continue;

          // remove event and data markers
          var event = root[0].substr(7);
          var data = root[1].substr(6);
          try {
            data = JSON.parse(data);
          } catch (err) {
            this.emit('error', new Error("Error parsing API reply: '".concat(piece, "', error message: '").concat(err, "'")));
          } finally {
            if (data) {
              // filter
              this.emit('element', {
                event: event,
                data: data
              });
            }
            // eslint-disable-next-line no-unsafe-finally
            continue;
          }
        }
        offset++;
      }
      this.message = chunk.slice(start, size);
    }
  }]);
  return Parser;
}(_events.EventEmitter);
var _default = Parser;
exports["default"] = _default;