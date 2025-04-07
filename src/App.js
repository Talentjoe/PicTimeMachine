// src/App.js
import React from 'react';
import ImageMapViewerWithTimeFilter from './components/ImageMapViewerWithTimeFilter';

function App() {
    return (
        <div>
            <h1 style={{ textAlign: 'center' }}>🗺️ 本地图片地图展示工具</h1>
            <ImageMapViewerWithTimeFilter />
        </div>
    );
}

export default App;
