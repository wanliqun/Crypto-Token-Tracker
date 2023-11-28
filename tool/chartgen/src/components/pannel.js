import React, { useEffect, useState } from 'react';
//import { data } from './data';
import G6 from '@antv/g6';
import { Button } from 'antd'; // import the Button component

export default function () {
  const ref = React.useRef(null);

  useEffect(() => {
  }, []);

  // define a function to handle the click event of the button
  const handleClick = () => {
    // export the whole graph as an image
    graph.downloadFullImage("fund-transfer", "image/png", { backgroundColor: '#fff', padding: [20, 20, 20, 20], })
  };

  return (
    <div ref={ref}>
      <Button type="primary" onClick={handleClick}>Download Image</Button>
    </div>
  );
}
