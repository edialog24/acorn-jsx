'use strict';

function _defaults(obj, defaults) { var keys = Object.getOwnPropertyNames(defaults); for (var i = 0; i < keys.length; i++) { var key = keys[i]; var value = Object.getOwnPropertyDescriptor(defaults, key); if (value && value.configurable && obj[key] === undefined) { Object.defineProperty(obj, key, value); } } return obj; }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _defaults(subClass, superClass); }

var XHTMLEntities = require('./xhtml');

var hexNumber = /^[\da-fA-F]+$/;
var decimalNumber = /^\d+$/; // The map to `acorn-jsx` tokens from `acorn` namespace objects.

var acornJsxMap = new WeakMap(); // Get the original tokens for the given `acorn` namespace object.

function getJsxTokens(acorn) {
  acorn = acorn.Parser.acorn || acorn;
  var acornJsx = acornJsxMap.get(acorn);

  if (!acornJsx) {
    var tt = acorn.tokTypes;
    var TokContext = acorn.TokContext;
    var TokenType = acorn.TokenType;
    var tc_oTag = new TokContext('<tag', false);
    var tc_cTag = new TokContext('</tag', false);
    var tc_expr = new TokContext('<tag>...</tag>', true, true);
    var tokContexts = {
      tc_oTag: tc_oTag,
      tc_cTag: tc_cTag,
      tc_expr: tc_expr
    };
    var tokTypes = {
      jsxName: new TokenType('jsxName'),
      jsxText: new TokenType('jsxText', {
        beforeExpr: true
      }),
      jsxTagStart: new TokenType('jsxTagStart'),
      jsxTagEnd: new TokenType('jsxTagEnd')
    };

    tokTypes.jsxTagStart.updateContext = function () {
      this.context.push(tc_expr); // treat as beginning of JSX expression

      this.context.push(tc_oTag); // start opening tag context

      this.exprAllowed = false;
    };

    tokTypes.jsxTagEnd.updateContext = function (prevType) {
      var out = this.context.pop();

      if (out === tc_oTag && prevType === tt.slash || out === tc_cTag) {
        this.context.pop();
        this.exprAllowed = this.curContext() === tc_expr;
      } else {
        this.exprAllowed = true;
      }
    };

    acornJsx = {
      tokContexts: tokContexts,
      tokTypes: tokTypes
    };
    acornJsxMap.set(acorn, acornJsx);
  }

  return acornJsx;
} // Transforms JSX element name to string.


function getQualifiedJSXName(object) {
  if (!object) return object;
  if (object.type === 'JSXIdentifier') return object.name;
  if (object.type === 'JSXNamespacedName') return object.namespace.name + ':' + object.name.name;
  if (object.type === 'JSXMemberExpression') return getQualifiedJSXName(object.object) + '.' + getQualifiedJSXName(object.property);
}

module.exports = function (options) {
  options = options || {};
  return function (Parser) {
    return plugin({
      allowNamespaces: options.allowNamespaces !== false,
      allowNamespacedObjects: !!options.allowNamespacedObjects
    }, Parser);
  };
}; // This is `tokTypes` of the peer dep.
// This can be different instances from the actual `tokTypes` this plugin uses.


Object.defineProperty(module.exports, "tokTypes", {
  get: function get_tokTypes() {
    return getJsxTokens(require("acorn")).tokTypes;
  },
  configurable: true,
  enumerable: true
});

function plugin(options, Parser) {
  var acorn = Parser.acorn || require("acorn");

  var acornJsx = getJsxTokens(acorn);
  var tt = acorn.tokTypes;
  var tok = acornJsx.tokTypes;
  var tokContexts = acorn.tokContexts;
  var tc_oTag = acornJsx.tokContexts.tc_oTag;
  var tc_cTag = acornJsx.tokContexts.tc_cTag;
  var tc_expr = acornJsx.tokContexts.tc_expr;
  var isNewLine = acorn.isNewLine;
  var isIdentifierStart = acorn.isIdentifierStart;
  var isIdentifierChar = acorn.isIdentifierChar;
  return /*#__PURE__*/function (_Parser) {
    _inheritsLoose(_class, _Parser);

    function _class() {
      return _Parser.apply(this, arguments) || this;
    }

    var _proto = _class.prototype;

    // Reads inline JSX contents token.
    _proto.jsx_readToken = function jsx_readToken() {
      var out = '',
          chunkStart = this.pos;

      for (;;) {
        if (this.pos >= this.input.length) this.raise(this.start, 'Unterminated JSX contents');
        var ch = this.input.charCodeAt(this.pos);

        switch (ch) {
          case 60: // '<'

          case 123:
            // '{'
            if (this.pos === this.start) {
              if (ch === 60 && this.exprAllowed) {
                ++this.pos;
                return this.finishToken(tok.jsxTagStart);
              }

              return this.getTokenFromCode(ch);
            }

            out += this.input.slice(chunkStart, this.pos);
            return this.finishToken(tok.jsxText, out);

          case 38:
            // '&'
            out += this.input.slice(chunkStart, this.pos);
            out += this.jsx_readEntity();
            chunkStart = this.pos;
            break;

          case 62: // '>'

          case 125:
            // '}'
            this.raise(this.pos, "Unexpected token `" + this.input[this.pos] + "`. Did you mean `" + (ch === 62 ? "&gt;" : "&rbrace;") + "` or " + "`{\"" + this.input[this.pos] + "\"}" + "`?");

          default:
            if (isNewLine(ch)) {
              out += this.input.slice(chunkStart, this.pos);
              out += this.jsx_readNewLine(true);
              chunkStart = this.pos;
            } else {
              ++this.pos;
            }

        }
      }
    };

    _proto.jsx_readNewLine = function jsx_readNewLine(normalizeCRLF) {
      var ch = this.input.charCodeAt(this.pos);
      var out;
      ++this.pos;

      if (ch === 13 && this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
        out = normalizeCRLF ? '\n' : '\r\n';
      } else {
        out = String.fromCharCode(ch);
      }

      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }

      return out;
    };

    _proto.jsx_readString = function jsx_readString(quote) {
      var out = '',
          chunkStart = ++this.pos;

      for (;;) {
        if (this.pos >= this.input.length) this.raise(this.start, 'Unterminated string constant');
        var ch = this.input.charCodeAt(this.pos);
        if (ch === quote) break;

        if (ch === 38) {
          // '&'
          out += this.input.slice(chunkStart, this.pos);
          out += this.jsx_readEntity();
          chunkStart = this.pos;
        } else if (isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.pos);
          out += this.jsx_readNewLine(false);
          chunkStart = this.pos;
        } else {
          ++this.pos;
        }
      }

      out += this.input.slice(chunkStart, this.pos++);
      return this.finishToken(tt.string, out);
    };

    _proto.jsx_readEntity = function jsx_readEntity() {
      var str = '',
          count = 0,
          entity;
      var ch = this.input[this.pos];
      if (ch !== '&') this.raise(this.pos, 'Entity must start with an ampersand');
      var startPos = ++this.pos;

      while (this.pos < this.input.length && count++ < 10) {
        ch = this.input[this.pos++];

        if (ch === ';') {
          if (str[0] === '#') {
            if (str[1] === 'x') {
              str = str.substr(2);
              if (hexNumber.test(str)) entity = String.fromCharCode(parseInt(str, 16));
            } else {
              str = str.substr(1);
              if (decimalNumber.test(str)) entity = String.fromCharCode(parseInt(str, 10));
            }
          } else {
            entity = XHTMLEntities[str];
          }

          break;
        }

        str += ch;
      }

      if (!entity) {
        this.pos = startPos;
        return '&';
      }

      return entity;
    } // Read a JSX identifier (valid tag or attribute name).
    //
    // Optimized version since JSX identifiers can't contain
    // escape characters and so can be read as single slice.
    // Also assumes that first character was already checked
    // by isIdentifierStart in readToken.
    ;

    _proto.jsx_readWord = function jsx_readWord() {
      var ch,
          start = this.pos;

      do {
        ch = this.input.charCodeAt(++this.pos);
      } while (isIdentifierChar(ch) || ch === 45); // '-'


      return this.finishToken(tok.jsxName, this.input.slice(start, this.pos));
    } // Parse next token as JSX identifier
    ;

    _proto.jsx_parseIdentifier = function jsx_parseIdentifier() {
      var node = this.startNode();
      if (this.type === tok.jsxName) node.name = this.value;else if (this.type.keyword) node.name = this.type.keyword;else this.unexpected();
      this.next();
      return this.finishNode(node, 'JSXIdentifier');
    } // Parse namespaced identifier.
    ;

    _proto.jsx_parseNamespacedName = function jsx_parseNamespacedName() {
      var startPos = this.start,
          startLoc = this.startLoc;
      var name = this.jsx_parseIdentifier();
      if (!options.allowNamespaces || !this.eat(tt.colon)) return name;
      var node = this.startNodeAt(startPos, startLoc);
      node.namespace = name;
      node.name = this.jsx_parseIdentifier();
      return this.finishNode(node, 'JSXNamespacedName');
    } // Parses element name in any form - namespaced, member
    // or single identifier.
    ;

    _proto.jsx_parseElementName = function jsx_parseElementName() {
      if (this.type === tok.jsxTagEnd) return '';
      var startPos = this.start,
          startLoc = this.startLoc;
      var node = this.jsx_parseNamespacedName();

      if (this.type === tt.dot && node.type === 'JSXNamespacedName' && !options.allowNamespacedObjects) {
        this.unexpected();
      }

      while (this.eat(tt.dot)) {
        var newNode = this.startNodeAt(startPos, startLoc);
        newNode.object = node;
        newNode.property = this.jsx_parseIdentifier();
        node = this.finishNode(newNode, 'JSXMemberExpression');
      }

      return node;
    } // Parses any type of JSX attribute value.
    ;

    _proto.jsx_parseAttributeValue = function jsx_parseAttributeValue() {
      switch (this.type) {
        case tt.braceL:
          var node = this.jsx_parseExpressionContainer();
          if (node.expression.type === 'JSXEmptyExpression') this.raise(node.start, 'JSX attributes must only be assigned a non-empty expression');
          return node;

        case tok.jsxTagStart:
        case tt.string:
          return this.parseExprAtom();

        default:
          this.raise(this.start, 'JSX value should be either an expression or a quoted JSX text');
      }
    } // JSXEmptyExpression is unique type since it doesn't actually parse anything,
    // and so it should start at the end of last read token (left brace) and finish
    // at the beginning of the next one (right brace).
    ;

    _proto.jsx_parseEmptyExpression = function jsx_parseEmptyExpression() {
      var node = this.startNodeAt(this.lastTokEnd, this.lastTokEndLoc);
      return this.finishNodeAt(node, 'JSXEmptyExpression', this.start, this.startLoc);
    } // Parses JSX expression enclosed into curly brackets.
    ;

    _proto.jsx_parseExpressionContainer = function jsx_parseExpressionContainer() {
      var node = this.startNode();
      this.next();
      node.expression = this.type === tt.braceR ? this.jsx_parseEmptyExpression() : this.parseExpression();
      this.expect(tt.braceR);
      return this.finishNode(node, 'JSXExpressionContainer');
    } // Parses following JSX attribute name-value pair.
    ;

    _proto.jsx_parseAttribute = function jsx_parseAttribute() {
      var node = this.startNode();

      if (this.eat(tt.braceL)) {
        this.expect(tt.ellipsis);
        node.argument = this.parseMaybeAssign();
        this.expect(tt.braceR);
        return this.finishNode(node, 'JSXSpreadAttribute');
      }

      node.name = this.jsx_parseNamespacedName();
      node.value = this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null;
      return this.finishNode(node, 'JSXAttribute');
    } // Parses JSX opening tag starting after '<'.
    ;

    _proto.jsx_parseOpeningElementAt = function jsx_parseOpeningElementAt(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);
      node.attributes = [];
      var nodeName = this.jsx_parseElementName();
      if (nodeName) node.name = nodeName;

      while (this.type !== tt.slash && this.type !== tok.jsxTagEnd) {
        node.attributes.push(this.jsx_parseAttribute());
      }

      node.selfClosing = this.eat(tt.slash);
      this.expect(tok.jsxTagEnd);
      return this.finishNode(node, nodeName ? 'JSXOpeningElement' : 'JSXOpeningFragment');
    } // Parses JSX closing tag starting after '</'.
    ;

    _proto.jsx_parseClosingElementAt = function jsx_parseClosingElementAt(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);
      var nodeName = this.jsx_parseElementName();
      if (nodeName) node.name = nodeName;
      this.expect(tok.jsxTagEnd);
      return this.finishNode(node, nodeName ? 'JSXClosingElement' : 'JSXClosingFragment');
    } // Parses entire JSX element, including it's opening tag
    // (starting after '<'), attributes, contents and closing tag.
    ;

    _proto.jsx_parseElementAt = function jsx_parseElementAt(startPos, startLoc) {
      var node = this.startNodeAt(startPos, startLoc);
      var children = [];
      var openingElement = this.jsx_parseOpeningElementAt(startPos, startLoc);
      var closingElement = null;

      if (!openingElement.selfClosing) {
        contents: for (;;) {
          switch (this.type) {
            case tok.jsxTagStart:
              startPos = this.start;
              startLoc = this.startLoc;
              this.next();

              if (this.eat(tt.slash)) {
                closingElement = this.jsx_parseClosingElementAt(startPos, startLoc);
                break contents;
              }

              children.push(this.jsx_parseElementAt(startPos, startLoc));
              break;

            case tok.jsxText:
              children.push(this.parseExprAtom());
              break;

            case tt.braceL:
              children.push(this.jsx_parseExpressionContainer());
              break;

            default:
              this.unexpected();
          }
        }

        if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
          this.raise(closingElement.start, 'Expected corresponding JSX closing tag for <' + getQualifiedJSXName(openingElement.name) + '>');
        }
      }

      var fragmentOrElement = openingElement.name ? 'Element' : 'Fragment';
      node['opening' + fragmentOrElement] = openingElement;
      node['closing' + fragmentOrElement] = closingElement;
      node.children = children;

      if (this.type === tt.relational && this.value === "<") {
        this.raise(this.start, "Adjacent JSX elements must be wrapped in an enclosing tag");
      }

      return this.finishNode(node, 'JSX' + fragmentOrElement);
    } // Parse JSX text
    ;

    _proto.jsx_parseText = function jsx_parseText() {
      var node = this.parseLiteral(this.value);
      node.type = "JSXText";
      return node;
    } // Parses entire JSX element from current position.
    ;

    _proto.jsx_parseElement = function jsx_parseElement() {
      var startPos = this.start,
          startLoc = this.startLoc;
      this.next();
      return this.jsx_parseElementAt(startPos, startLoc);
    };

    _proto.parseExprAtom = function parseExprAtom(refShortHandDefaultPos) {
      if (this.type === tok.jsxText) return this.jsx_parseText();else if (this.type === tok.jsxTagStart) return this.jsx_parseElement();else return _Parser.prototype.parseExprAtom.call(this, refShortHandDefaultPos);
    };

    _proto.readToken = function readToken(code) {
      var context = this.curContext();
      if (context === tc_expr) return this.jsx_readToken();

      if (context === tc_oTag || context === tc_cTag) {
        if (isIdentifierStart(code)) return this.jsx_readWord();

        if (code == 62) {
          ++this.pos;
          return this.finishToken(tok.jsxTagEnd);
        }

        if ((code === 34 || code === 39) && context == tc_oTag) return this.jsx_readString(code);
      }

      if (code === 60 && this.exprAllowed && this.input.charCodeAt(this.pos + 1) !== 33) {
        ++this.pos;
        return this.finishToken(tok.jsxTagStart);
      }

      return _Parser.prototype.readToken.call(this, code);
    };

    _proto.updateContext = function updateContext(prevType) {
      if (this.type == tt.braceL) {
        var curContext = this.curContext();
        if (curContext == tc_oTag) this.context.push(tokContexts.b_expr);else if (curContext == tc_expr) this.context.push(tokContexts.b_tmpl);else _Parser.prototype.updateContext.call(this, prevType);
        this.exprAllowed = true;
      } else if (this.type === tt.slash && prevType === tok.jsxTagStart) {
        this.context.length -= 2; // do not consider JSX expr -> JSX open tag -> ... anymore

        this.context.push(tc_cTag); // reconsider as closing tag context

        this.exprAllowed = false;
      } else {
        return _Parser.prototype.updateContext.call(this, prevType);
      }
    };

    _createClass(_class, null, [{
      key: "acornJsx",
      // Expose actual `tokTypes` and `tokContexts` to other plugins.
      get: function get() {
        return acornJsx;
      }
    }]);

    return _class;
  }(Parser);
}
