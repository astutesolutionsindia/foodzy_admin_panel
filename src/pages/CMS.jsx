import { useState, useEffect, useRef } from 'react';
import {
  Image, LayoutGrid, Plus, Trash2, Edit, Loader2, XCircle,
  Upload, MapPin, Undo2, RotateCcw, Save, Navigation, CheckCircle2, Check
} from 'lucide-react';
import api from '../config/api';

export default function CMS() {
  const [activeTab, setActiveTab] = useState('BANNERS');
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modal State
  const [modalType, setModalType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  // MULTI-POLYGON GEOFENCE STATE
  const [savedZones, setSavedZones] = useState([]);
  const [draftZone, setDraftZone] = useState([]);
  const [enforceGeofence, setEnforceGeofence] = useState(false);
  const [savingGeofence, setSavingGeofence] = useState(false);

  const [testPin, setTestPin] = useState(null);
  const [testMode, setTestMode] = useState(false);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayersRef = useRef([]);
  const draftLayerRef = useRef(null);
  const markersRef = useRef([]);
  const testMarkerRef = useRef(null);
  const testModeRef = useRef(false);

  useEffect(() => {
    testModeRef.current = testMode;
  }, [testMode]);

  const fetchData = async () => {
    try {
      const [bannersRes, categoriesRes, geofenceRes] = await Promise.all([
        api.get('/admin/banners'),
        api.get('/admin/categories'),
        api.get('/admin/geofence').catch(() => ({
          data: { service_polygon: [], enforce_geofence: false }
        }))
      ]);
      setBanners(bannersRes.data || []);
      setCategories(categoriesRes.data || []);

      const rawPoly = geofenceRes.data?.service_polygon || [];
      if (rawPoly.length > 0 && Array.isArray(rawPoly[0]) && Array.isArray(rawPoly[0][0])) {
        setSavedZones(rawPoly);
      } else if (rawPoly.length >= 3) {
        setSavedZones([rawPoly]);
      } else {
        setSavedZones([]);
      }

      setEnforceGeofence(Boolean(geofenceRes.data?.enforce_geofence));
    } catch (err) {
      console.error('Failed to fetch CMS data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ensureLeafletLoaded = () => {
    return new Promise((resolve) => {
      if (window.L) return resolve(window.L);

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const existingScript = document.getElementById('leaflet-js');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.L));
        return;
      }

      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.body.appendChild(script);
    });
  };

  const checkPointInsideSingle = (lat, lng, poly) => {
    if (!Array.isArray(poly) || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = Number(poly[i][0]), yi = Number(poly[i][1]);
      const xj = Number(poly[j][0]), yj = Number(poly[j][1]);
      const intersect =
        yi > lng !== yj > lng &&
        lat < ((xj - xi) * (lng - yi)) / (yj - yi || 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const checkPointInsideAll = (lat, lng, allZones) => {
    for (const zone of allZones) {
      if (checkPointInsideSingle(lat, lng, zone)) return true;
    }
    return false;
  };

  useEffect(() => {
    if (activeTab !== 'BOUNDARY') return;

    let isMounted = true;
    ensureLeafletLoaded().then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        let defaultCenter = [32.7266, 74.8570];
        if (savedZones.length > 0 && savedZones[0].length > 0) {
          defaultCenter = [Number(savedZones[0][0][0]), Number(savedZones[0][0][1])];
        }

        const map = L.map(mapContainerRef.current).setView(defaultCenter, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        map.on('click', (e) => {
          const clickedLat = Number(e.latlng.lat.toFixed(6));
          const clickedLng = Number(e.latlng.lng.toFixed(6));

          if (testModeRef.current) {
            setTestPin({ lat: clickedLat, lng: clickedLng, needsCheck: true });
          } else {
            setDraftZone((prev) => [...prev, [clickedLat, clickedLng]]);
          }
        });

        mapInstanceRef.current = map;
      }

      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (testPin?.needsCheck) {
      const allActivePolygons = [...savedZones];
      if (draftZone.length >= 3) allActivePolygons.push(draftZone);

      const isInside = checkPointInsideAll(testPin.lat, testPin.lng, allActivePolygons);
      setTestPin({ lat: testPin.lat, lng: testPin.lng, inside: isInside, needsCheck: false });
    }
  }, [testPin, savedZones, draftZone]);

  useEffect(() => {
    if (activeTab !== 'BOUNDARY' && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      polygonLayersRef.current = [];
      draftLayerRef.current = null;
      markersRef.current = [];
      testMarkerRef.current = null;
    }
  }, [activeTab]);

  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    polygonLayersRef.current.forEach((layer) => map.removeLayer(layer));
    polygonLayersRef.current = [];

    if (draftLayerRef.current) {
      map.removeLayer(draftLayerRef.current);
      draftLayerRef.current = null;
    }

    savedZones.forEach((zone) => {
      if (zone.length >= 3) {
        const poly = L.polygon(zone, {
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 0.25,
          weight: 2
        }).addTo(map);
        polygonLayersRef.current.push(poly);
      }
    });

    draftZone.forEach((pt, idx) => {
      const icon = L.divIcon({
        className: 'custom-vertex-pin',
        html: `<div style="background:#ef4444;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([pt[0], pt[1]], { icon, draggable: true }).addTo(map);
      marker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        setDraftZone((prev) => {
          const updated = [...prev];
          updated[idx] = [Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))];
          return updated;
        });
      });
      markersRef.current.push(marker);
    });

    if (draftZone.length >= 3) {
      draftLayerRef.current = L.polygon(draftZone, {
        color: '#16a34a',
        fillColor: '#22c55e',
        fillOpacity: 0.35,
        weight: 3,
        dashArray: '5, 5'
      }).addTo(map);
    } else if (draftZone.length === 2) {
      draftLayerRef.current = L.polyline(draftZone, {
        color: '#f97316',
        weight: 3,
        dashArray: '6, 6'
      }).addTo(map);
    }

    if (testMarkerRef.current) {
      map.removeLayer(testMarkerRef.current);
      testMarkerRef.current = null;
    }
    if (testPin && !testPin.needsCheck) {
      const pinColor = testPin.inside ? '#16a34a' : '#dc2626';
      const testIcon = L.divIcon({
        className: 'test-pin-icon',
        html: `<div style="background:${pinColor};color:white;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:bold;white-space:nowrap;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${testPin.inside ? '✓ Deliverable' : '✕ Out of Zone'}</div>`,
        iconSize: [100, 26],
        iconAnchor: [50, 13]
      });
      testMarkerRef.current = L.marker([testPin.lat, testPin.lng], { icon: testIcon }).addTo(map);
    }
  }, [draftZone, savedZones, testPin, activeTab]);

  const handleFinishZone = () => {
    if (draftZone.length < 3) {
      alert('A zone needs at least 3 points to form a closed shape.');
      return;
    }
    setSavedZones((prev) => [...prev, draftZone]);
    setDraftZone([]);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
        }
      },
      () => alert('Could not fetch your current GPS location.')
    );
  };

  const handleSaveGeofence = async () => {
    const allFinalZones = [...savedZones];
    if (draftZone.length >= 3) {
      allFinalZones.push(draftZone);
    }

    if (enforceGeofence && allFinalZones.length === 0) {
      alert('Please draw at least one completely closed polygon before enabling enforcement.');
      return;
    }

    setSavingGeofence(true);
    try {
      await api.put('/admin/geofence', {
        service_polygon: allFinalZones,
        enforce_geofence: enforceGeofence
      });
      if (draftZone.length >= 3) {
        setSavedZones(allFinalZones);
        setDraftZone([]);
      }
      alert('Multi-polygon service boundaries saved and updated live across all apps!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save service boundary.');
    } finally {
      setSavingGeofence(false);
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingId(item?.id || null);
    if (type === 'BANNER') {
      let popupData = { popupTitle: '', popupDescription: '', popupImageUrl: '' };
      if (item?.redirect_type === 'BOTTOM_SHEET_POPUP' && item?.redirect_value) {
        try {
          popupData = JSON.parse(item.redirect_value);
        } catch (e) {
          console.error('Failed to parse popup JSON');
        }
      }
      setFormData(
        item || {
          title: '',
          image_url: '',
          redirect_type: 'NONE',
          redirect_value: '',
          sort_order: 0,
          is_active: true,
          ...popupData
        }
      );
    } else {
      setFormData(
        item || {
          name: '',
          search_query: '',
          image_url: '',
          sort_order: 0,
          is_active: true
        }
      );
    }
  };

  const handlePopupUpdate = (field, value) => {
    const newForm = { ...formData, [field]: value };
    if (newForm.redirect_type === 'BOTTOM_SHEET_POPUP') {
      newForm.redirect_value = JSON.stringify({
        popupTitle: newForm.popupTitle || '',
        popupDescription: newForm.popupDescription || '',
        popupImageUrl: newForm.popupImageUrl || ''
      });
    }
    setFormData(newForm);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be smaller than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.image_url) {
      alert('Please upload an image first.');
      return;
    }

    const endpoint = modalType === 'BANNER' ? '/admin/banners' : '/admin/categories';
    try {
      if (editingId) {
        await api.put(`${endpoint}/${editingId}`, formData);
      } else {
        await api.post(endpoint, formData);
      }
      setModalType(null);
      fetchData();
    } catch (err) {
      alert('Failed to save changes.');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this item?')) return;
    const endpoint = type === 'BANNER' ? `/admin/banners/${id}` : `/admin/categories/${id}`;
    try {
      await api.delete(endpoint);
      fetchData();
    } catch (err) {
      alert('Failed to delete.');
    }
  };

  const toggleStatus = async (type, item) => {
    const endpoint = type === 'BANNER' ? `/admin/banners/${item.id}` : `/admin/categories/${item.id}`;
    try {
      await api.put(endpoint, { ...item, is_active: !item.is_active });
      fetchData();
    } catch (err) {
      console.error('Failed to toggle status');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">App CMS & Geofence Manager</h2>
          <p className="text-gray-500">
            Control customer app banners, categories, and your exact multi-zone delivery boundaries.
          </p>
        </div>
        {activeTab !== 'BOUNDARY' && (
          <button
            onClick={() => openModal(activeTab.slice(0, -1))}
            className="flex items-center px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" /> Add {activeTab === 'BANNERS' ? 'Banner' : 'Category'}
          </button>
        )}
      </div>

      <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('BANNERS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'BANNERS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Image className="w-4 h-4 mr-2" /> App Banners
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'CATEGORIES'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutGrid className="w-4 h-4 mr-2" /> Horizontal Categories
        </button>
        <button
          onClick={() => setActiveTab('BOUNDARY')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'BOUNDARY'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="w-4 h-4 mr-2" /> Service Boundary (Map)
          {enforceGeofence && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full">
              ACTIVE
            </span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'BANNERS' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Image Preview</th>
                <th className="p-4 font-medium">Details</th>
                <th className="p-4 font-medium">Routing</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {banners.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <img
                      src={b.image_url}
                      alt="Banner"
                      className="w-32 h-16 object-cover rounded-lg border border-gray-200"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{b.title || 'Untitled'}</div>
                    <div className="text-xs text-gray-500">Order: {b.sort_order}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-600">
                      {b.redirect_type}
                    </span>
                    {b.redirect_type === 'BOTTOM_SHEET_POPUP' ? (
                      <div className="text-xs text-green-600 mt-1 font-medium">
                        Interactive App Popup
                      </div>
                    ) : (
                      b.redirect_value && (
                        <div className="text-xs text-blue-500 mt-1">{b.redirect_value}</div>
                      )
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleStatus('BANNER', b)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                        b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {b.is_active ? 'Live' : 'Hidden'}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openModal('BANNER', b)}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('BANNER', b.id)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">
                    No banners created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'CATEGORIES' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Icon</th>
                <th className="p-4 font-medium">Name & Search Query</th>
                <th className="p-4 font-medium text-center">Order</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    {c.image_url ? (
                      <img src={c.image_url} alt="Icon" className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">
                        No Img
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500">Query: {c.search_query}</div>
                  </td>
                  <td className="p-4 text-center font-mono">{c.sort_order}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleStatus('CATEGORY', c)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                        c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.is_active ? 'Live' : 'Hidden'}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openModal('CATEGORY', c)}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('CATEGORY', c.id)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">
                    No categories created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'BOUNDARY' && (
          <div className="p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  Delivery Zones ({savedZones.length + (draftZone.length >= 3 ? 1 : 0)} Active)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Draw independent polygons around specific towns or sectors. Finish one zone, then click the map to start another.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={enforceGeofence}
                    onChange={(e) => setEnforceGeofence(e.target.checked)}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  <span className="text-xs font-semibold text-gray-700">Enforce Boundary</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setTestMode(!testMode);
                    if (testMode) setTestPin(null);
                  }}
                  className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                    testMode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {testMode ? 'Testing Mode: Click Map' : 'Test a Pin'}
                </button>

                <button
                  type="button"
                  onClick={handleLocateMe}
                  className="flex items-center px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Navigation className="w-4 h-4 mr-1.5" /> Center on Me
                </button>

                {draftZone.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftZone((prev) => prev.slice(0, -1))}
                    className="flex items-center px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Undo2 className="w-4 h-4 mr-1.5" /> Undo Point
                  </button>
                )}

                {draftZone.length >= 3 && (
                  <button
                    type="button"
                    onClick={handleFinishZone}
                    className="flex items-center px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Finish Current Zone
                  </button>
                )}

                <button
                  type="button"
                  disabled={savedZones.length === 0 && draftZone.length === 0}
                  onClick={() => {
                    if (window.confirm('Wipe ALL polygons from the map?')) {
                      setSavedZones([]);
                      setDraftZone([]);
                      setTestPin(null);
                    }
                  }}
                  className="flex items-center px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 border border-red-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Clear Map
                </button>

                <button
                  type="button"
                  onClick={handleSaveGeofence}
                  disabled={savingGeofence}
                  className="flex items-center px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {savingGeofence ? 'Saving...' : 'Save All Zones'}
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-inner">
              <div ref={mapContainerRef} className="w-full h-[520px] z-0" />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 bg-gray-50 px-4 py-3 rounded-lg border border-gray-100 gap-2">
              <div>
                <span className="font-semibold text-gray-700">Status: </span>
                {enforceGeofence ? (
                  <span className="text-green-600 font-semibold">
                    Geofence ACTIVE — Orders blocked if placed outside the{' '}
                    {savedZones.length + (draftZone.length >= 3 ? 1 : 0)} defined zones.
                  </span>
                ) : (
                  <span className="text-gray-600">Geofence is currently turned off.</span>
                )}
              </div>
              {testPin && !testPin.needsCheck && (
                <div className={`font-semibold ${testPin.inside ? 'text-green-600' : 'text-red-600'}`}>
                  Test Pin ({testPin.lat}, {testPin.lng}):{' '}
                  {testPin.inside ? 'INSIDE SERVICE AREA ✓' : 'OUTSIDE SERVICE AREA ✕'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalType && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">
                {editingId ? 'Edit' : 'Add'} {modalType === 'BANNER' ? 'Banner' : 'Category'}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload App Image
                </label>
                {formData.image_url ? (
                  <div className="relative w-full h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image_url: '' })}
                      className="absolute top-2 right-2 bg-white rounded-full text-red-500 hover:text-red-700 shadow-md p-1 cursor-pointer"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 font-medium">Click to upload image</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>

              {modalType === 'BANNER' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title (Internal)
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                      placeholder="e.g. Summer Sale"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Redirect Action
                      </label>
                      <select
                        value={formData.redirect_type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          let resetValue = '';
                          if (newType === 'BOTTOM_SHEET_POPUP') {
                            resetValue = JSON.stringify({
                              popupTitle: '',
                              popupDescription: '',
                              popupImageUrl: ''
                            });
                          }
                          setFormData({
                            ...formData,
                            redirect_type: newType,
                            redirect_value: resetValue,
                            popupTitle: '',
                            popupDescription: '',
                            popupImageUrl: ''
                          });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                      >
                        <option value="NONE">No Action</option>
                        <option value="RESTAURANT">Restaurant ID</option>
                        <option value="COUPON">Coupon Code</option>
                        <option value="SEARCH">Search Query</option>
                        <option value="BOTTOM_SHEET_POPUP">Bottom Sheet Popup</option>
                      </select>
                    </div>

                    {formData.redirect_type !== 'NONE' &&
                      formData.redirect_type !== 'BOTTOM_SHEET_POPUP' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Target Value
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.redirect_value}
                            onChange={(e) =>
                              setFormData({ ...formData, redirect_value: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                            placeholder="e.g. SAVE50 or Burger"
                          />
                        </div>
                      )}
                  </div>

                  {formData.redirect_type === 'BOTTOM_SHEET_POPUP' && (
                    <div className="p-4 bg-brand/5 border border-brand/20 rounded-xl space-y-4 mt-4">
                      <h4 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center">
                        <LayoutGrid className="w-3 h-3 mr-1" /> Popup Layout Config
                      </h4>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Popup Title
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.popupTitle || ''}
                          onChange={(e) => handlePopupUpdate('popupTitle', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand"
                          placeholder="e.g. Foodzy Wallet Live!"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Popup Description (Supports multiline)
                        </label>
                        <textarea
                          required
                          rows="3"
                          value={formData.popupDescription || ''}
                          onChange={(e) => handlePopupUpdate('popupDescription', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand resize-none"
                          placeholder="Explain the rules, features, or promotional details here..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Internal Modal Image URL (Optional)
                        </label>
                        <input
                          type="url"
                          value={formData.popupImageUrl || ''}
                          onChange={(e) => handlePopupUpdate('popupImageUrl', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                      placeholder="e.g. Pizzas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Query Trigger
                    </label>
                    <input
                      type="text"
                      value={formData.search_query}
                      onChange={(e) => setFormData({ ...formData, search_query: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                      placeholder="e.g. pizza"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    required
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData({ ...formData, sort_order: parseInt(e.target.value || '0', 10) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
                <div className="flex items-end mb-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-5 h-5 text-brand rounded focus:ring-brand"
                    />
                    <span className="text-sm font-medium text-gray-700">Is Active</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 cursor-pointer font-medium shadow-sm"
                >
                  Save Content
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}