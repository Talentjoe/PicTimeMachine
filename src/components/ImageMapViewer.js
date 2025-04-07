// src/components/ImageMapViewer.js
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import EXIF from 'exif-js';

import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadow,
});

L.Marker.prototype.options.icon = DefaultIcon;

const dmsToDecimal = (dms, ref) => {
    const [deg, min, sec] = dms;
    let decimal = deg + min / 60 + sec / 3600;
    return (ref === 'S' || ref === 'W') ? -decimal : decimal;
};

function ImageMapViewer() {
    const [images, setImages] = useState([]);

    const handleFolderSelect = async (e) => {
        const files = Array.from(e.target.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        const results = [];

        for (const file of imageFiles) {
            const url = URL.createObjectURL(file);
            const arrayBuffer = await file.arrayBuffer();

            try {
                const exifData = EXIF.readFromBinaryFile(arrayBuffer);

                if (
                    exifData.GPSLatitude &&
                    exifData.GPSLongitude &&
                    exifData.GPSLatitudeRef &&
                    exifData.GPSLongitudeRef
                ) {
                    const lat = dmsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                    const lng = dmsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef);

                    results.push({ name: file.name, url, lat, lng });
                }
            } catch (err) {
                console.warn('EXIF 读取失败:', file.name, err);
            }
        }

        setImages(results);
    };

    return (
        <div>
            <h2>选择图片文件夹</h2>
            <input type="file" webkitdirectory="true" multiple onChange={handleFolderSelect} />

            <MapContainer center={[0, 0]} zoom={2} style={{ height: '600px', width: '100%', marginTop: 20 }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                />

                {images.map((img, idx) => (
                    <Marker key={idx} position={[img.lat, img.lng]}>
                        <Popup>
                            <strong>{img.name}</strong>
                            <br />
                            <img src={img.url} width="200" alt={img.name} />
                            <br />
                            📍{img.lat.toFixed(6)}, {img.lng.toFixed(6)}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}

export default ImageMapViewer;
