import React, {useMemo, useState} from 'react';
import {MapContainer, TileLayer} from 'react-leaflet';
import L from 'leaflet';
import EXIF from 'exif-js';
import 'react-datepicker/dist/react-datepicker.css';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import Timeline from "./TimeLine.tsx";
import 'leaflet.markercluster';
import {MarkerClusterGroupWrapper} from "./MarkerClusterGroupWrapper.tsx";
import FocusOnMarkers from "./focusOnMarkers.js";
import FitBounds from "./FitBound";

let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 40],
    iconAnchor: [12, 40],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const dmsToDecimal = (dms, ref) => {
    const [deg, min, sec] = dms;
    let decimal = deg + min / 60 + sec / 3600;
    return (ref === 'S' || ref === 'W') ? -decimal : decimal;
};

function parseCustomTime(timeStr) {
    const [year, month, day, hour, minute, second] = timeStr
        .split(/[:\s]/)
        .map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
}

function ImageMapViewerWithTimeFilter() {
    const [currentSecond, setCurrentSecond] = useState(0);
    const [images, setImages] = useState([]);
    const [startTime] = useState(null); //not used
    const [endTime] = useState(null); // not used
    const timelineRef = React.useRef(null);
    const [isChina, setIsChina] = useState(false);
    const [isAmap, setAmap] = useState(false);

    const handleSecondChange = (second: number) => {
        setCurrentSecond(second);
    };


    const handleFolderSelect = async (e) => {
        const files = Array.from(e.target.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        const results = images;
        for (const file of imageFiles) {
            const url = URL.createObjectURL(file);
            const arrayBuffer = await file.arrayBuffer();

            try {
                const exifData = EXIF.readFromBinaryFile(arrayBuffer);
                const lat = exifData.GPSLatitude ? dmsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef) : null;
                const lng = exifData.GPSLongitude ? dmsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef) : null;
                const date = parseCustomTime(exifData.DateTimeOriginal);

                results.push({name: file.name, url, lat, lng, date});
            } catch (err) {
                console.warn(`Failed to read EXIF from ${file.name}`, err);
            }
        }

        const uresults = [...new Set(results)];
        uresults.sort((a, b) => a.date - b.date);

        alert(`总共有 ${uresults.length} 张有效图片`);

        setImages(uresults);
    };

    const handleSetChina = () => {
        isChina ? setIsChina(false) : setIsChina(true);
    };

    const handleSetAmap = () => {
        isAmap ? setAmap(false) : setAmap(true);
    };

    const filteredImages = useMemo(() => {
        if (currentSecond === 0 || currentSecond === images.length) {
            return images.filter(img => {
                if (!img.lat || !img.lng || !img.date) return false;
                return (!startTime || img.date >= startTime) && (!endTime || img.date <= endTime);
            });
        }
        return images
            .filter(img => {
                if (!img.lat || !img.lng || !img.date) return false;
                return (!startTime || img.date >= startTime) && (!endTime || img.date <= endTime);
            })
            .slice(0, currentSecond);
    }, [images, startTime, endTime, currentSecond]);

    const focusImageFilter = useMemo(() => {
        return images
            .filter(img => {
                if (!img.lat || !img.lng || !img.date) return false;
                return (!startTime || img.date >= startTime) && (!endTime || img.date <= endTime);
            })
            .slice(Math.max(currentSecond - 1, 0), currentSecond);
    }, [images, startTime, endTime, currentSecond]);

    const handleDelete = () => {
        setImages([]);
        setCurrentSecond(0);
    }
    // <FitBounds positions={(focusImageFilter ?? []).map(img => [img.lat, img.lng])}/>
    return (
        <div>
                <MapContainer center={[0, 0]} zoom={3} style={{height: '80vh', width: '100%', marginTop: 20}}>
                    {
                        isChina ? isAmap ?
                            <TileLayer
                                key="china"
                                url="https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=	7bd4dd0bc5f8b384925e97953f9325aa"
                                subdomains={['0', '1', '2', '3', '4', '5', '6', '7']}
                                attribution="&copy; 国家地理信息公共服务平台"
                            /> :
                                <TileLayer
                                    key="china-Amap"
                                    url="http://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
                                    subdomains={['1', '2', '3', '4']}
                                    attribution="&copy; 高德地图"
                                /> :
                            <TileLayer
                                key="osm"
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap"
                            />

                    }

                    <MarkerClusterGroupWrapper images={filteredImages}
                                               highlight={!(currentSecond === images.length+1 || currentSecond === 0)}/>

                    {(currentSecond === images.length+1 || currentSecond === 0) ?
                        (<FitBounds positions={(filteredImages ?? []).map(img => [img.lat, img.lng])}/>) :
                        (<FocusOnMarkers points={focusImageFilter}/>)}


                </MapContainer>
                <div>
                    <button onClick={handleSetChina}>设置为 {isChina ? "外国" : "中国"}</button>
                    {isChina ? <button onClick={handleSetAmap}>设置为 {isAmap?"高德地图":"天地图"}</button> : null }
                    <input type="file" multiple onChange={handleFolderSelect}/>
                    <button onClick={handleDelete}>删除全部</button>
                    <i> 当前有: {images.length} 张图片</i>
                </div>

            <div>
                <Timeline
                    ref={timelineRef}
                    startTime={0}
                    endTime={images.length+1}
                    onSecondChange={handleSecondChange}
                />

            </div>
            <div style={{marginTop: 20}}>
                <h3>图片</h3>
                <ul>
                    {images.map((img, i) => (
                        <li key={i}>
                            {img.name} {img.date ? `(${img.date.toLocaleString()})` : ''}
                        </li>
                    ))}
                </ul>

            </div>
        </div>
    );
}

export default ImageMapViewerWithTimeFilter;
