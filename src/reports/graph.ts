import { Stack } from 'stack-typescript';

export interface IGraphEdge<T> {
  from: Node<T> | null
  to: Node<T>
  weight: any
}

export class Node<T> {
    data: T;
    adjList: Map<Node<T>, any>;
    comparator: (a: T, b: T) => number;
  
    constructor(data: T, comparator: (a: T, b: T) => number) {
      this.data = data;
      this.adjList = new Map<Node<T>, any>();
      this.comparator = comparator;
    }
  
    addAdjacent(node: Node<T>, weight: any): void {
        this.adjList.set(node, weight)
    }
  
    removeAdjacent(data: T) {
        for (const node of this.adjList.keys()) {
            if (this.comparator(node.data, data) === 0) {
                this.adjList.delete(node)
                break
            }
        }
    }
  }
  
export class Graph<T> {
    nodes: Map<T, Node<T>> = new Map();
    comparator: (a: T, b: T) => number;
  
    constructor(comparator: (a: T, b: T) => number) {
      this.comparator = comparator;
    }
  
    /**
     * Add a new node if it was not added before
     *
     * @param {T} data
     * @returns {Node<T>}
     */
    addNode(data: T): Node<T> {
      let node = this.nodes.get(data);
  
      if (node) return node;
  
      node = new Node(data, this.comparator);
      this.nodes.set(data, node);
  
      return node;
    }
  
    /**
     * Remove a node, also remove it from other nodes adjacency list
     *
     * @param {T} data
     * @returns {Node<T> | null}
     */
    removeNode(data: T): Node<T> | null {
      const nodeToRemove = this.nodes.get(data);
  
      if (!nodeToRemove) return null;
  
      this.nodes.forEach((node) => {
        node.removeAdjacent(nodeToRemove.data);
      });
  
      this.nodes.delete(data);
  
      return nodeToRemove;
    }
  
    /**
     * Create an edge between two nodes
     *
     * @param {T} source
     * @param {T} destination
     */
    addEdge(source: T, destination: T, weight: any): void {
      const sourceNode = this.addNode(source);
      const destinationNode = this.addNode(destination);
  
      sourceNode.addAdjacent(destinationNode, weight);
    }
  
    /**
     * Remove an edge between two nodes
     *
     * @param {T} source
     * @param {T} destination
     */
    removeEdge(source: T, destination: T): void {
      const sourceNode = this.nodes.get(source);
      const destinationNode = this.nodes.get(destination);
  
      if (sourceNode && destinationNode) {
        sourceNode.removeAdjacent(destination);
      }
    }

  /**
   * Depth-first traverse the edges
   *
   * @param {T} first
   * @returns
   */
  async depthFirstTraverseEdges(first: T, traverse: (edge: IGraphEdge<T>, visited: Map<T, boolean>)=>(Promise<void>)) {
    const startN = this.nodes.get(first)
    if (!startN) return

    const visited: Map<T, boolean> = new Map();
    const visitEdges: Stack<IGraphEdge<T>> = new Stack<IGraphEdge<T>>()
    visitEdges.push({from: null, to: startN, weight: null})

    while (visitEdges.length != 0) {
      const edge = visitEdges.pop()
      if (edge && !visited.has(edge.to.data)) {
        await traverse(edge, visited)
        visited.set(edge.to.data, true)

        edge.to.adjList.forEach((weight: any, node: Node<T>)=>{
          visitEdges.push({from: edge.to, to: node, weight: weight})
        })
      }
    }
  }
}

export class StrGraph extends Graph<string> {
  constructor() {
    super((a: string, b:string): number=>{
      if (a != b) return -1
      return 0
    })
  }
}