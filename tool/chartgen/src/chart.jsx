import React, { useEffect } from 'react'
import { isObject } from '@antv/util';
import G6 from '@antv/g6';

/**
 * Fund Transfer
 */
const colorMap = {
  A: '#000000', //'#72CC4A',
  B: '#FF0000', //'#1A91FF',
  //C: '#FFAA15',
};

var globalGraph;

G6.registerNode(
  'round-rect',
  {
    drawShape: function drawShape(cfg, group) {
      const width = cfg.style.width;
      const stroke = cfg.style.stroke;
      const rect = group.addShape('rect', {
        attrs: {
          x: -width / 2,
          y: -15,
          width,
          height: 30,
          radius: 15,
          stroke,
          lineWidth: 1.2,
          fillOpacity: 1,
        },
        // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
        name: 'rect-shape',
      });
      group.addShape('circle', {
        attrs: {
          x: -width / 2,
          y: 0,
          r: 3,
          fill: stroke,
        },
        // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
        name: 'circle-shape',
      });
      group.addShape('circle', {
        attrs: {
          x: width / 2,
          y: 0,
          r: 3,
          fill: stroke,
        },
        // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
        name: 'circle-shape2',
      });
      return rect;
    },
    getAnchorPoints: function getAnchorPoints() {
      return [
        [0, 0.5],
        [1, 0.5],
      ];
    },
    update: function update(cfg, item) {
      const group = item.getContainer();
      const children = group.get('children');
      const node = children[0];
      const circleLeft = children[1];
      const circleRight = children[2];

      const stroke = cfg.style.stroke;

      if (stroke) {
        node.attr('stroke', stroke);
        circleLeft.attr('fill', stroke);
        circleRight.attr('fill', stroke);
      }
    },
  },
  'single-node'
);

G6.registerEdge('fund-polyline', {
  itemType: 'edge',
  draw: function draw(cfg, group) {
    const startPoint = cfg.startPoint;
    const endPoint = cfg.endPoint;

    const Ydiff = endPoint.y - startPoint.y;

    const slope = Ydiff !== 0 ? Math.min(500 / Math.abs(Ydiff), 20) : 0;

    const cpOffset = slope > 15 ? 0 : 16;
    const offset = Ydiff < 0 ? cpOffset : -cpOffset;

    const line1EndPoint = {
      x: startPoint.x + slope,
      y: endPoint.y + offset,
    };
    const line2StartPoint = {
      x: line1EndPoint.x + cpOffset,
      y: endPoint.y,
    };

    // 控制点坐标
    const controlPoint = {
      x:
        ((line1EndPoint.x - startPoint.x) * (endPoint.y - startPoint.y)) /
          (line1EndPoint.y - startPoint.y) +
        startPoint.x,
      y: endPoint.y,
    };

    let path = [
      ['M', startPoint.x, startPoint.y],
      ['L', line1EndPoint.x, line1EndPoint.y],
      [
        'Q',
        controlPoint.x,
        controlPoint.y,
        line2StartPoint.x,
        line2StartPoint.y,
      ],
      ['L', endPoint.x, endPoint.y],
    ];

    if (Math.abs(Ydiff) <= 5) {
      path = [
        ['M', startPoint.x, startPoint.y],
        ['L', endPoint.x, endPoint.y],
      ];
    }
 
    const endArrow =
      cfg?.style && cfg.style.endArrow ? cfg.style.endArrow : false;
    if (isObject(endArrow)) endArrow.fill = stroke;
    const line = group.addShape('path', {
      attrs: {
        path,
        stroke: colorMap[cfg.data && cfg.data.type],
        lineWidth: 1.2,
        endArrow,
      },
      // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
      name: 'path-shape',
    });

    const labelLeftOffset = 0;
    const labelTopOffset = 8;
    // amount
    const amount = group.addShape('text', {
      attrs: {
        text: cfg.data && cfg.data.amount,
        x: line2StartPoint.x + labelLeftOffset,
        y: endPoint.y - labelTopOffset - 2,
        fontSize: 14,
        textAlign: 'left',
        textBaseline: 'middle',
        fill: '#000000D9',
      },
      // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
      name: 'text-shape-amount',
    });
    /*
    // type
    group.addShape('text', {
      attrs: {
        text: cfg.data && cfg.data.type,
        x: line2StartPoint.x + labelLeftOffset,
        y: endPoint.y - labelTopOffset - amount.getBBox().height - 2,
        fontSize: 10,
        textAlign: 'left',
        textBaseline: 'middle',
        fill: '#000000D9',
      },
      // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
      name: 'text-shape-type',
    });
    
    // date
    group.addShape('text', {
      attrs: {
        text: cfg.data && cfg.data.date,
        x: line2StartPoint.x + labelLeftOffset,
        y: endPoint.y + labelTopOffset + 4,
        fontSize: 12,
        fontWeight: 300,
        textAlign: 'left',
        textBaseline: 'middle',
        fill: '#000000D9',
      },
      // must be assigned in G6 3.3 and later versions. it can be any string you want, but should be unique in a custom item type
      name: 'text-shape-date',
    }); 
    */
    return line;
  },
});

const Chart = () => {
  const ref = React.useRef(null)
  let graph = null

  useEffect(() => {
    if(!graph) {
      const width = document.getElementById('container').scrollWidth;
      const height = document.getElementById('container').scrollHeight || 500;
      const graph = new G6.Graph({
        container: 'container',
        width,
        height,
        layout: {
            type: 'dagre',
            rankdir: 'LR',
            nodesep: 30,
            ranksep: 100,
        },
        modes: {
            default: ['drag-canvas', 'zoom-canvas'],
        },
        defaultNode: {
            type: 'round-rect',
            labelCfg: {
            style: {
                fill: '#000000A6',
                fontSize: 10,
            },
            },
            style: {
            //stroke: '#72CC4A',
            stroke: '#8b0000',
            width: 220,
            },
        },
        defaultEdge: {
            type: 'fund-polyline',
            style: {
            endArrow: true,
            },
        },
      });

      if (typeof window !== 'undefined')
          window.onresize = () => {
              if (!graph || graph.get('destroyed')) return;
              if (!container || !container.scrollWidth || !container.scrollHeight) return;
              graph.changeSize(container.scrollWidth, container.scrollHeight);
          };
      
      globalGraph = graph
  }}, [])

  return <div ref={ref}></div>
}
  
export {Chart, globalGraph}