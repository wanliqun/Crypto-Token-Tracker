//import Chart from "./chart.jsx"
import React, { useState } from 'react';
import { Button, Input } from 'antd'; // import the Button component
import { DownloadOutlined } from '@ant-design/icons';
import {globalGraph} from "./chart.jsx"

const { TextArea } = Input;

const Header = () => {
    const [size, setSize] = useState('large'); // default is 'middle'
    const [inputText, setInputText] = useState("")
    const [paths, setPaths] = useState([])

    const generateChart = (e) => {
        let nodeId = 1
        const nodemap = new Map(), edgemap = new Map()
        const nodes = [], edges = []

        const lines = inputText.split(/\n|\r/)
        for (const line of lines) {
            const result = decodeString(line)
            for (let i = 0; i < result.length; i++) {
                const point = result[i]
                if (!nodemap.has(point[0])) {
                    const nid = (nodeId++).toString()
                    nodemap.set(point[0], nid)
                    nodes.push({
                        id: nid,
                        label: point[0],
                    })
                }

                const lastPoint = i > 0 ? result[i-1] : undefined
                if (i > 0 && !edgemap.has(lastPoint[0]+point[0])) {
                    edgemap.set(lastPoint[0]+point[0], true)
                    edges.push({
                        source: nodemap.get(lastPoint[0]),
                        target: nodemap.get(point[0]),
                        data: {
                          type: (i == result.length - 1) ? 'B' : 'A',
                          amount: point[1].toFixed(0) + 'U',
                        },
                    })
                }
            }
        }

        const graph = globalGraph
        graph.data({
            nodes: nodes,
            edges: edges,
        }); 
        graph.render();

        const gedges = graph.getEdges();
        gedges.forEach(function (edge) {
            const line = edge.getKeyShape();
            const stroke = line.attr('stroke');
            const targetNode = edge.getTarget();
            targetNode.update({
                style: {
                stroke,
                },
            });
        });
        graph.paint();
    }

    function decodeString(str) {
        const parts = str.split("->");
        const result = [];
        for (let part of parts) {
            const subparts = part.split("(");
            const address = subparts[0];
            const amount = subparts[1] ? Number(subparts[1].slice(0, -1)) : 0;
            result.push([address, amount]);
        }
        return result;
    }

    return <div style={{margin: '10px 0'}}>
        <label for="path-textarea">Please enter you transfer flow paths with each in a line here:</label>
        <TextArea id="path-textarea" 
            placeholder="Your transfer flow paths separated by new line" 
            autoSize={{ minRows: 5, maxRows: 10 }}
            onChange={(e)=>{setInputText(e.target.value)}} />
        <Button style={{margin: '5px 5px'}} type="primary" size={size} onClick={generateChart}>Generate Chart</Button>
        <Button style={{margin: '5px 5px'}} type="primary" icon={<DownloadOutlined />} size={size} onClick={(e) => {
            globalGraph.downloadFullImage("transfer-flow-chart", "image/png", { backgroundColor: '#fff', padding: [20, 20, 20, 20], })
        }}>Download Chart</Button>
    </div>
}

export default Header