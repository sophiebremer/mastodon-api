"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _request = _interopRequireDefault(require("request"));
var _events = require("events");
var _helpers = _interopRequireDefault(require("./helpers"));
var _parser = _interopRequireDefault(require("./parser"));
var _settings = require("./settings");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
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
var StreamingAPIConnection = /*#__PURE__*/function (_EventEmitter) {
  _inherits(StreamingAPIConnection, _EventEmitter);
  var _super = _createSuper(StreamingAPIConnection);
  function StreamingAPIConnection(requestOptions, mastodonOptions) {
    var _this;
    _classCallCheck(this, StreamingAPIConnection);
    _this = _super.call(this);
    _this.requestOptions = requestOptions;
    _this.mastodonOptions = mastodonOptions;
    return _this;
  }

  /**
   * Resets the connection.
   * - clears request, response, parser
   * - removes scheduled reconnect handle (if one was scheduled)
   * - stops the stall abort timeout handle (if one was scheduled)
   */
  _createClass(StreamingAPIConnection, [{
    key: "_resetConnection",
    value: function _resetConnection() {
      if (this.request) {
        // clear our reference to the `request` instance
        this.request.removeAllListeners();
        this.request.destroy();
      }
      if (this.response) {
        // clear our reference to the http.IncomingMessage instance
        this.response.removeAllListeners();
        this.response.destroy();
      }
      if (this.parser) {
        this.parser.removeAllListeners();
      }

      // ensure a scheduled reconnect does not occur (if one was scheduled)
      // this can happen if we get a close event before .stop() is called
      clearTimeout(this._scheduledReconnect);
      delete this._scheduledReconnect;

      // clear our stall abort timeout
      this._stopStallAbortTimeout();
    }

    /**
     * Resets the parameters used in determining the next reconnect time
     */
  }, {
    key: "_resetRetryParams",
    value: function _resetRetryParams() {
      // delay for next reconnection attempt
      this._connectInterval = 0;
      // flag indicating whether we used a 0-delay reconnect
      this._usedFirstReconnect = false;
    }
  }, {
    key: "_startPersistentConnection",
    value: function _startPersistentConnection() {
      var self = this;
      self._resetConnection();
      self._setupParser();
      self._resetStallAbortTimeout();
      self.request = _request["default"].get(self.requestOptions);
      self.emit('connect', self.request);
      self.request.on('response', function (response) {
        // reset our reconnection attempt flag so next attempt goes through with 0 delay
        // if we get a transport-level error
        self._usedFirstReconnect = false;
        // start a stall abort timeout handle
        self._resetStallAbortTimeout();
        self.response = response;
        if (_settings.STATUS_CODES_TO_ABORT_ON.includes(response.statusCode)) {
          var body = '';
          self.response.on('data', function (chunk) {
            body += chunk.toString('utf8');
            try {
              body = JSON.parse(body);
            } catch (jsonDecodeError) {
              // if non-JSON text was returned, we'll just attach it to the error as-is
            }
            var error = _helpers["default"].makeMastodonError("Bad Streaming API request: ".concat(self.response.statusCode));
            error.statusCode = self.response.statusCode;
            error = _helpers["default"].attachBodyInfoToError(error, body);
            self.emit('error', error);
            // stop the stream explicitly so we don't reconnect
            self.stop();
            body = null;
          });
        } else {
          self.response.on('data', function (chunk) {
            self._connectInterval = 0;
            self._resetStallAbortTimeout();
            self.parser.parse(chunk.toString('utf8'));
          });
          self.response.on('error', function (err) {
            // expose response errors on twit instance
            self.emit('error', err);
          });

          // connected without an error response from Dweet.io, emit `connected` event
          // this must be emitted after all its event handlers are bound
          // so the reference to `self.response` is not
          // interfered-with by the user until it is emitted
          self.emit('connected', self.response);
        }
      });
      self.request.on('close', self._onClose.bind(self));
      self.request.on('error', function () {
        self._scheduleReconnect.bind(self);
      });
      return self;
    }

    /**
     * Handle when the request or response closes.
     * Schedule a reconnect
     *
     */
  }, {
    key: "_onClose",
    value: function _onClose() {
      var self = this;
      self._stopStallAbortTimeout();
      if (self._scheduledReconnect) {
        // if we already have a reconnect scheduled, don't schedule another one.
        // this race condition can happen if the http.ClientRequest
        // and http.IncomingMessage both emit `close`
        return;
      }
      self._scheduleReconnect();
    }

    /**
     * Kick off the http request, and persist the connection
     */
  }, {
    key: "start",
    value: function start() {
      this._resetRetryParams();
      this._startPersistentConnection();
      return this;
    }

    /**
     * Abort the http request, stop scheduled reconnect (if one was scheduled) and clear state
     */
  }, {
    key: "stop",
    value: function stop() {
      // clear connection variables and timeout handles
      this._resetConnection();
      this._resetRetryParams();
      return this;
    }

    /**
     * Stop and restart the stall abort timer (called when new data is received)
     *
     * If we go 90s without receiving data from dweet.io, we abort the request & reconnect.
     */
  }, {
    key: "_resetStallAbortTimeout",
    value: function _resetStallAbortTimeout() {
      var self = this;
      // stop the previous stall abort timer
      self._stopStallAbortTimeout();
      // start a new 90s timeout to trigger a close & reconnect if no data received
      self._stallAbortTimeout = setTimeout(function () {
        self._scheduleReconnect();
      }, 90000);
      return this;
    }
  }, {
    key: "_stopStallAbortTimeout",
    value: function _stopStallAbortTimeout() {
      clearTimeout(this._stallAbortTimeout);
      // mark the timer as `null` so it is clear
      // via introspection that the timeout is not scheduled
      delete this._stallAbortTimeout;
      return this;
    }

    /**
     * Computes the next time a reconnect should occur (based on the last HTTP response received)
     * and starts a timeout handle to begin reconnecting after `self._connectInterval` passes.
     *
     * @return {Undefined}
     */
  }, {
    key: "_scheduleReconnect",
    value: function _scheduleReconnect() {
      var self = this;
      if (self.response && self.response.statusCode === 420) {
        // start with a 1 minute wait and double each attempt
        if (!self._connectInterval) {
          self._connectInterval = 60000;
        } else {
          self._connectInterval *= 2;
        }
      } else if (self.response && String(self.response.statusCode).charAt(0) === '5') {
        // 5xx errors
        // start with a 5s wait, double each attempt up to 320s
        if (!self._connectInterval) {
          self._connectInterval = 5000;
        } else if (self._connectInterval < 320000) {
          self._connectInterval *= 2;
        } else {
          self._connectInterval = 320000;
        }
      } else {
        // we did not get an HTTP response from our last connection attempt.
        // DNS/TCP error, or a stall in the stream (and stall timer closed the connection)
        // eslint-disable-next-line no-lonely-if
        if (!self._usedFirstReconnect) {
          // first reconnection attempt on a valid connection should occur immediately
          self._connectInterval = 0;
          self._usedFirstReconnect = true;
        } else if (self._connectInterval < 16000) {
          // linearly increase delay by 250ms up to 16s
          self._connectInterval += 250;
        } else {
          // cap out reconnect interval at 16s
          self._connectInterval = 16000;
        }
      }

      // schedule the reconnect
      self._scheduledReconnect = setTimeout(function () {
        self._startPersistentConnection();
      }, self._connectInterval);
      self.emit('reconnect', self.request, self.response, self._connectInterval);
    }
  }, {
    key: "_setupParser",
    value: function _setupParser() {
      var self = this;
      self.parser = new _parser["default"]();
      self.parser.on('element', function (msg) {
        self.emit('message', msg);
      });
      self.parser.on('error', function (err) {
        self.emit('parser-error', err);
      });
      self.parser.on('connection-limit-exceeded', function (err) {
        self.emit('error', err);
      });
    }
  }, {
    key: "_handleDisconnect",
    value: function _handleDisconnect(msg) {
      this.emit('disconnect', msg);
      this.stop();
    }
  }]);
  return StreamingAPIConnection;
}(_events.EventEmitter);
var _default = StreamingAPIConnection;
exports["default"] = _default;