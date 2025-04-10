import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import 'leaflet/dist/leaflet.css';

alert("欢迎来到我的网站，该网站是一个基于React和Leaflet的地图应用，使用了TypeScript和Ant Design等技术栈。\n" +
    "该网站可以通过读取图片文件的EXIF信息，在地图上标记您的的轨迹，带您重温过去的时光\n" +
    "本网站属于静态网站 虽然显示为上传 其实并未真正上传 请勿担心您的照片会泄露\n" +
    "想要使用该网站 请确保您有一个文件夹内放有图片 且图片内exif信息中的gps信息为受损\n" +
    "使用微信图片可能会导致无法使用\n" +
    "点击选择文件 选择放有图片的文件夹 点击确定 点击上传 确认多少文件成功识别\n" +
    "如果您在国内 请将地图切换为中国 否则推荐使用osm\n" +
    "然后您可以点击播放按钮 他将带您回忆过去的旅程！感谢您的使用用，该项目为开源项目\n" +
    "开源地址：https://github.com/Talentjoe/PicTimeMachine \n\n" +
    "该项目致亲爱的老妈！" );
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
