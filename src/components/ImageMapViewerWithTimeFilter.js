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
import Timeline from "./TimeLine.tsx";
import 'leaflet.markercluster';
import {MarkerClusterGroupWrapper} from "./MarkerClusterGroupWrapper.tsx";

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
                const date = parseCustomTime(exifData.DateTimeOriginal);

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


            <MapContainer center={[0, 0]} zoom={2} style={{height: '700px', width: '100%', marginTop: 20}}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                />
                <MarkerClusterGroupWrapper images={filteredImages}/>

                <FitBounds positions={(filteredImages ?? []).map(img => [img.lat, img.lng])}/>

            </MapContainer>

            <input type="file" webkitdirectory="true" multiple onChange={handleFolderSelect}/>

            <div >
                <Timeline startTime={0} endTime={60}></Timeline>
            </div>
            <div style={{marginTop: 20}}>
                <h3>图片</h3>
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
