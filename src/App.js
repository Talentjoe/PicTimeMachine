// src/App.js
import React from 'react';
import ImageMapViewerWithTimeFilter from './components/ImageMapViewerWithTimeFilter';
import cookie from 'react-cookies'


function App() {
    var t;
    try{
        t = cookie.load('viewed')

    }
    catch (e) {
        t = false;
        console.log(e)
    }

    if(!t) {
        alert("欢迎来到我的网站，该网站是一个基于React和Leaflet的地图应用，使用了TypeScript和Ant Design等技术栈。\n" +
            "该网站可以通过读取图片文件的EXIF信息，在地图上标记您的的轨迹，带您重温过去的时光\n" +
            "本网站属于静态网站 虽然显示为上传 其实并未真正上传 不必担心您的照片会泄露\n" +
            "想要使用该网站 请确保您有一个文件夹内放有图片 且图片内exif信息中的gps信息为受损\n" +
            "使用微信图片可能会导致无法使用\n" +
            "点击选择文件 选择放有图片的文件夹 点击确定 点击上传 确认多少文件成功识别\n" +
            "如果您在国内 请将地图切换为中国 否则推荐使用osm\n" +
            "然后您可以点击播放按钮 希望能带您走上回忆过去的旅程！感谢您的使用。该提示仅会显示一次。\n" +
            "开源地址：https://github.com/Talentjoe/PicTimeMachine \n\n" +
            "该项目致亲爱的老妈！");
        cookie.save('viewed', true, { path: '/' })
    }

    return (
        <div>
            <ImageMapViewerWithTimeFilter />
        </div>
    );
}

export default App;
