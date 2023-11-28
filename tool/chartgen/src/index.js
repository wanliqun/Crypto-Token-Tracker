/* eslint-disable */
import React from 'react';
import ReactDOM from 'react-dom';
import Header from './header.jsx';
import {Chart} from './chart.jsx';

ReactDOM.render(<Header/>, document.getElementById('header'));
ReactDOM.render(<Chart/>, document.getElementById('container'));