import React, {useEffect, useState} from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import EXIF from 'exif-js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useMap } from 'react-leaflet';

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

const parseExifDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        return new Date(dateStr.replace(/:/g, '-').replace(' ', 'T'));
    } catch {
        return null;
    }
};

function FitBounds({ positions }) {
    const map = useMap();

    useEffect(() => {
        if (positions.length === 0) return;
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [20, 20] }); // padding 可微调视图边距
    }, [positions, map]);

    return null;
}

function ImageMapViewerWithTimeFilter() {
    const [images, setImages] = useState([]);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);

    const handleFolderSelect = async (e) => {
        const files = Array.from(e.target.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        const results = [];
        for (const file of imageFiles) {
            const url = URL.createObjectURL(file);
            const arrayBuffer = await file.arrayBuffer();

            try {
                const exifData = EXIF.readFromBinaryFile(arrayBuffer);
                const lat = exifData.GPSLatitude ? dmsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef) : null;
                const lng = exifData.GPSLongitude ? dmsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef) : null;
                const date = parseExifDate(exifData.DateTimeOriginal || exifData.DateTime);

                results.push({ name: file.name, url, lat, lng, date });
            } catch (err) {
                console.warn(`Failed to read EXIF from ${file.name}`, err);
            }
        }

        setImages(results);
    };

    const filteredImages = images.filter(img => {
        if (!img.lat || !img.lng || !img.date) return false;
        return (!startTime || img.date >= startTime) && (!endTime || img.date <= endTime);
    });

    return (
        <div>
            <h2>本地图片地图展示</h2>
            <input type="file" webkitdirectory="true" multiple onChange={handleFolderSelect}/>


            <MapContainer center={[0, 0]} zoom={2} style={{height: '700px', width: '100%', marginTop: 20}}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                />
                {filteredImages.map((img, idx) => (
                    <Marker key={idx} position={[img.lat, img.lng]}>
                        <Popup>
                            <strong>{img.name}</strong>
                            <br/>
                            {img.date?.toLocaleString()}
                            <br/>
                            <img src={img.url} width="200" alt={img.name}/>
                        </Popup>
                    </Marker>
                ))}

                <FitBounds positions={(filteredImages ?? []).map(img => [img.lat, img.lng])}/>

            </MapContainer>

            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem', zIndex: 10000000}}>
                <div>
                    起始时间：
                    <DatePicker
                        selected={startTime}
                        onChange={(date) => setStartTime(date)}
                        showTimeSelect
                        dateFormat="Pp"
                    />
                </div>
                <div>
                    结束时间：
                    <DatePicker
                        selected={endTime}
                        onChange={(date) => setEndTime(date)}
                        showTimeSelect
                        dateFormat="Pp"
                    />
                </div>
            </div>
            {/* 📦 预留：未来图片管理功能接口 */}
            <div style={{marginTop: 20}}>
                <h3>🗃️ 图片管理（开发中）</h3>
                <ul>
                    {images.map((img, i) => (
                        <li key={i}>{img.name} {img.date ? `(${img.date.toLocaleString()})` : ''}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default ImageMapViewerWithTimeFilter;
