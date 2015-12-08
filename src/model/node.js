import {Fragment, emptyFragment} from "./fragment"
import {sameMarks} from "./mark"

const emptyArray = []

/**
 * Document node class
 */
export class Node {
  constructor(type, attrs, content, marks) {
    if (content && !(content instanceof Fragment)) throw new Error("OH NO")
    this.type = type
    this.attrs = attrs
    this.content = content || emptyFragment
    this.marks = marks || emptyArray
  }

  get size() { return this.content.size }

  get width() { return 1 }

  child(off) { return this.content.child(off) }

  iter(start, end) { return this.content.iter(start, end) }
  reverseIter(start, end) { return this.content.reverseIter(start, end) }

  chunkBefore(off) { return this.content.chunkBefore(off) }
  chunkAfter(off) { return this.content.chunkAfter(off) }

  forEach(f) { this.content.forEach(f) }

  get textContent() { return this.content.textContent }

  get firstChild() { return this.content.firstChild }
  get lastChild() { return this.content.lastChild }

  sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks)
  }

  hasMarkup(type, attrs, marks) {
    return this.type == type && Node.sameAttrs(this.attrs, attrs) && sameMarks(this.marks, marks || emptyArray)
  }

  static sameAttrs(a, b) {
    if (a == b) return true
    let empty = isEmpty(a)
    if (empty != isEmpty(b)) return false
    if (!empty) for (var prop in a)
      if (a[prop] !== b[prop]) return false
    return true
  }

  copy(content = null) {
    return new this.constructor(this.type, this.attrs, content, this.marks)
  }

  mark(marks) {
    return new this.constructor(this.type, this.attrs, this.content, marks)
  }

  slice(from, to) {
    return this.copy(this.content.slice(from, to))
  }

  splice(from, to, replace) {
    return this.copy(this.content.slice(0, from).append(replace).append(this.content.slice(to)))
  }

  append(slice, joinLeft = 0, joinRight = 0) {
    return this.copy(this.content.append(slice, joinLeft, joinRight))
  }

  replace(pos, node) {
    return this.copy(this.content.replace(pos, node))
  }

  replaceDeep(path, node, depth = 0) {
    if (depth == path.length) return node
    let pos = path[depth]
    return this.replace(pos, this.child(pos).replaceDeep(path, node, depth + 1))
  }

  close(depth, side) {
    if (depth == 0 && this.size == 0 && !this.type.canBeEmpty)
      return this.copy(this.type.defaultContent())
    let closedContent
    if (depth > 0 && (closedContent = this.content.close(depth - 1, side)) != this.content)
      return this.copy(closedContent)
    return this
  }

  /**
   * Get a child node given a path.
   *
   * @param  {array} path
   * @return {Node}
   */
  path(path) {
    for (var i = 0, node = this; i < path.length; node = node.child(path[i]), i++) {}
    return node
  }

  nodeAfter(pos) {
    return this.path(pos.path).child(pos.offset)
  }

  pathNodes(path) {
    let nodes = []
    for (var i = 0, node = this;; i++) {
      nodes.push(node)
      if (i == path.length) break
      node = node.child(path[i])
    }
    return nodes
  }

  isValidPos(pos, requireTextblock) {
    for (let i = 0, node = this;; i++) {
      if (i == pos.path.length) {
        if (requireTextblock && !node.isTextblock) return false
        return pos.offset <= node.size
      } else {
        let n = pos.path[i]
        if (n >= node.size) return false
        node = node.child(n)
      }
    }
  }

  nodesBetween(from, to, f, path = [], parent = null) {
    if (f(this, path, parent) === false) return
    this.content.nodesBetween(from, to, f, path, this)
  }

  inlineNodesBetween(from, to, f) {
    this.nodesBetween(from, to, (node, path, parent) => {
      if (node.isInline) {
        let last = path.length - 1
        f(node, path.slice(0, last), path[last], path[last] + node.width, parent)
      }
    })
  }

  sliceBetween(from, to, depth = 0) {
    return this.copy(this.content.sliceBetween(from, to, depth))
  }

  get isBlock() { return this.type.isBlock }
  get isTextblock() { return this.type.isTextblock }
  get isInline() { return this.type.isInline }
  get isText() { return this.type.isText }

  toString() {
    let name = this.type.name
    if (this.content.size)
      name += "(" + this.content.toString() + ")"
    return wrapMarks(this.marks, name)
  }

  toJSON() {
    let obj = {type: this.type.name}
    for (let _ in this.attrs) {
      obj.attrs = this.attrs
      return obj
    }
    if (this.size)
      obj.content = this.content.toJSON()
    if (this.marks.length)
      obj.marks = this.marks
    return obj
  }

  // This is a hack to be able to treat a node object as an iterator result
  get value() { return this }

  static fromJSON(schema, json) {
    let type = schema.nodeType(json.type)
    let content = Fragment.fromJSON(schema, json.content)
    return type.create(json.attrs, content, json.marks && json.marks.map(schema.markFromJSON))
  }
}

if (typeof Symbol != "undefined") Node.prototype[Symbol.iterator] = function() { return this.iter() }

export class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks)
    this.text = content
  }

  toString() { return wrapMarks(this.marks, JSON.stringify(this.text)) }

  get textContent() { return this.text }

  get width() { return this.text.length }

  mark(marks) {
    return new TextNode(this.type, this.attrs, this.text, marks)
  }
}

function wrapMarks(marks, str) {
  for (let i = marks.length - 1; i >= 0; i--)
    str = marks[i].type.name + "(" + str + ")"
  return str
}

function isEmpty(obj) {
  if (obj) for (let _ in obj) return false
  return true
}
