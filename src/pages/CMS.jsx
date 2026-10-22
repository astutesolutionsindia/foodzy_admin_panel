import { useState, useEffect, useRef } from 'react';
import { Image, LayoutGrid, Plus, Trash2, Edit, Loader2, XCircle, Upload, MapPin, Undo2, RotateCcw, Save, Navigation, CheckCircle2 } from 'lucide-react';
import api from '../config/api';

export default function CMS() {
  const [activeTab, setActiveTab] = useState('BANNERS');
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modal State for Banners & Categories
  const [modalType, setModalType] = useState(null); // 'BANNER' | 'CATEGORY' | null
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  // Geofence Polygon State
  const [polygonPoints, setPolygonPoints] = useState([]); // Array of [lat, lng]
  const [enforceGeofence, setEnforceGeofence] = useState(false);
  const [savingGeofence, setSavingGeofence] = useState(false);
  const [testPin, setTestPin] = useState(null); // { lat, lng, inside }
  const [testMode, setTestMode] = useState(false);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
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
        api.get('/admin/geofence').catch(() => ({ data: { service_polygon: [], enforce_geofence: false } }))
      ]);
      setBanners(bannersRes.data);
      setCategories(categoriesRes.data);

      const savedPoly = Array.isArray(geofenceRes.data?.service_polygon)
        ? geofenceRes.data.service_polygon
        : [];
      setPolygonPoints(savedPoly);
      setEnforceGeofence(Boolean(geofenceRes.data?.enforce_geofence));
    } catch (err) {
      console.error("Failed to fetch CMS data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dynamically load Leaflet CSS & JS from CDN (No npm install required)
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

  // Client-side Ray-Casting check for instant "Test Pin" feedback on the map
  const checkPointInside = (lat, lng, poly) => {
    if (!Array.isArray(poly) || poly.length < 3) return true;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = Number(poly[i][0]), yi = Number(poly[i][1]);
      const xj = Number(poly[j][0]), yj = Number(poly[j][1]);
      const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Initialize Leaflet Map when switching to BOUNDARY tab
  useEffect(() => {
    if (activeTab !== 'BOUNDARY') return;

    let isMounted = true;
    ensureLeafletLoaded().then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        // Default center: Doda / J&K (33.1457, 75.5480) or first saved polygon point
        const defaultCenter = polygonPoints.length > 0
          ? [Number(polygonPoints[0][0]), Number(polygonPoints[0][1])]
          : [33.1457, 75.5480];

        const map = L.map(mapContainerRef.current).setView(defaultCenter, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        map.on('click', (e) => {
          const clickedLat = Number(e.latlng.lat.toFixed(6));
          const clickedLng = Number(e.latlng.lng.toFixed(6));

          if (testModeRef.current) {
            setPolygonPoints((currentPoly) => {
              const isInside = checkPointInside(clickedLat, clickedLng, currentPoly);
              setTestPin({ lat: clickedLat, lng: clickedLng, inside: isInside });
              return currentPoly;
            });
          } else {
            setPolygonPoints((prev) => [...prev, [clickedLat, clickedLng]]);
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

  // Cleanup map instance when leaving BOUNDARY tab
  useEffect(() => {
    if (activeTab !== 'BOUNDARY' && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      polygonLayerRef.current = null;
      markersRef.current = [];
      testMarkerRef.current = null;
    }
  }, [activeTab]);

  // Redraw polygon & vertex markers whenever polygonPoints or testPin changes
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old vertex markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Clear old polygon
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }

    // Draw numbered vertex markers (draggable!)
    polygonPoints.forEach((pt, idx) => {
      const icon = L.divIcon({
        className: 'custom-vertex-pin',
        html: `<div style="background:#ef4444;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([pt[0], pt[1]], { icon, draggable: true }).addTo(map);
      marker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        setPolygonPoints((prev) => {
          const updated = [...prev];
          updated[idx] = [Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))];
          return updated;
        });
      });
      markersRef.current.push(marker);
    });

    // Draw shaded polygon or connecting line
    if (polygonPoints.length >= 3) {
      polygonLayerRef.current = L.polygon(polygonPoints, {
        color: '#16a34a',
        fillColor: '#22c55e',
        fillOpacity: 0.25,
        weight: 3
      }).addTo(map);
    } else if (polygonPoints.length === 2) {
      polygonLayerRef.current = L.polyline(polygonPoints, {
        color: '#f97316',
        weight: 3,
        dashArray: '6, 6'
      }).addTo(map);
    }

    // Draw Test Pin if active
    if (testMarkerRef.current) {
      map.removeLayer(testMarkerRef.current);
      testMarkerRef.current = null;
    }
    if (testPin) {
      const inside = checkPointInside(testPin.lat, testPin.lng, polygonPoints);
      const pinColor = inside ? '#16a34a' : '#dc2626';
      const testIcon = L.divIcon({
        className: 'test-pin-icon',
        html: `<div style="background:${pinColor};color:white;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:bold;white-space:nowrap;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${inside ? '✓ Deliverable' : '✕ Out of Zone'}</div>`,
        iconSize: [100, 26],
        iconAnchor: [50, 13]
      });
      testMarkerRef.current = L.marker([testPin.lat, testPin.lng], { icon: testIcon }).addTo(map);
    }
  }, [polygonPoints, testPin, activeTab]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
        }
      },
      () => alert("Could not fetch your current GPS location.")
    );
  };

  const handleSaveGeofence = async () => {
    if (enforceGeofence && polygonPoints.length < 3) {
      alert("Please click at least 3 points on the map to form a closed service boundary before enabling enforcement.");
      return;
    }

    setSavingGeofence(true);
    try {
      await api.put('/admin/geofence', {
        service_polygon: polygonPoints,
        enforce_geofence: enforceGeofence
      });
      alert("Service boundary saved and updated live across all apps!");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save service boundary.");
    } finally {
      setSavingGeofence(false);
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingId(item?.id || null);
    if (type === 'BANNER') {
      setFormData(item || { title: '', image_url: '', redirect_type: 'NONE', redirect_value: '', sort_order: 0, is_active: true });
    } else {
      setFormData(item || { name: '', search_query: '', image_url: '', sort_order: 0, is_active: true });
    }
  };

  // Convert uploaded image to Base64 String instantly on the frontend
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5MB");
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
      alert("Please upload an image first.");
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
      alert("Failed to save changes.");
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this item?')) return;
    const endpoint = type === 'BANNER' ? `/admin/banners/${id}` : `/admin/categories/${id}`;
    try {
      await api.delete(endpoint);
      fetchData();
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  const toggleStatus = async (type, item) => {
    const endpoint = type === 'BANNER' ? `/admin/banners/${item.id}` : `/admin/categories/${item.id}`;
    try {
      await api.put(endpoint, { ...item, is_active: !item.is_active });
      fetchData();
    } catch (err) {
      console.error("Failed to toggle status");
    }
  };

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="w-10 h-10 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">App CMS & Geofence Manager</h2>
          <p className="text-gray-500">Control customer app banners, categories, and your exact delivery zone boundary.</p>
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
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${activeTab === 'BANNERS' ? 'border-b-2 border-brand text-brand' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Image className="w-4 h-4 mr-2" /> App Banners
        </button>
        <button 
          onClick={() => setActiveTab('CATEGORIES')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${activeTab === 'CATEGORIES' ? 'border-b-2 border-brand text-brand' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <LayoutGrid className="w-4 h-4 mr-2" /> Horizontal Categories
        </button>
        <button 
          onClick={() => setActiveTab('BOUNDARY')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${activeTab === 'BOUNDARY' ? 'border-b-2 border-brand text-brand' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MapPin className="w-4 h-4 mr-2" /> Service Boundary (Map)
          {enforceGeofence && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full">ACTIVE</span>
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
              {banners.map(b => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <img src={b.image_url} alt="Banner" className="w-32 h-16 object-cover rounded-lg border border-gray-200" />
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{b.title || 'Untitled'}</div>
                    <div className="text-xs text-gray-500">Order: {b.sort_order}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-600">{b.redirect_type}</span>
                    {b.redirect_value && <div className="text-xs text-blue-500 mt-1">{b.redirect_value}</div>}
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => toggleStatus('BANNER', b)} className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.is_active ? 'Live' : 'Hidden'}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openModal('BANNER', b)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg cursor-pointer"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete('BANNER', b.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400">No banners created yet.</td></tr>
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
              {categories.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    {c.image_url ? <img src={c.image_url} alt="Icon" className="w-12 h-12 object-contain" /> : <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">No Img</div>}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500">Query: {c.search_query}</div>
                  </td>
                  <td className="p-4 text-center font-mono">{c.sort_order}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => toggleStatus('CATEGORY', c)} className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Live' : 'Hidden'}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openModal('CATEGORY', c)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg cursor-pointer"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete('CATEGORY', c.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400">No categories created yet.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {/* INTERACTIVE SERVICE BOUNDARY (POLYGON GEOFENCE) TAB */}
        {activeTab === 'BOUNDARY' && (
          <div className="p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  Draw Your Delivery Zone Polygon ({polygonPoints.length} Points)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Click anywhere on the map to drop boundary pins around your town. Drag numbered pins to fine-tune roads. Orders outside the green shaded zone will be blocked when enforcement is enabled.
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
                  title="Center map on my GPS location"
                >
                  <Navigation className="w-4 h-4 mr-1.5" /> Center on Me
                </button>

                <button
                  type="button"
                  disabled={polygonPoints.length === 0}
                  onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))}
                  className="flex items-center px-3 py-2 bg-white hover:bg-gray-100 disabled:opacity-40 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Undo2 className="w-4 h-4 mr-1.5" /> Undo Last Point
                </button>

                <button
                  type="button"
                  disabled={polygonPoints.length === 0}
                  onClick={() => {
                    if (window.confirm('Clear all boundary points from the map?')) {
                      setPolygonPoints([]);
                      setTestPin(null);
                    }
                  }}
                  className="flex items-center px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 border border-red-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Clear All
                </button>

                <button
                  type="button"
                  onClick={handleSaveGeofence}
                  disabled={savingGeofence}
                  className="flex items-center px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {savingGeofence ? 'Saving...' : 'Save Service Boundary'}
                </button>
              </div>
            </div>

            {/* Interactive Map Container */}
            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-inner">
              <div ref={mapContainerRef} className="w-full h-[520px] z-0" />
            </div>

            {/* Coordinate Summary Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 bg-gray-50 px-4 py-3 rounded-lg border border-gray-100 gap-2">
              <div>
                <span className="font-semibold text-gray-700">Status: </span>
                {polygonPoints.length < 3 ? (
                  <span className="text-orange-600 font-medium">
                    Need at least {3 - polygonPoints.length} more point(s) to close the polygon.
                  </span>
                ) : enforceGeofence ? (
                  <span className="text-green-600 font-semibold">
                    Geofence ACTIVE — Customers outside the {polygonPoints.length}-point polygon cannot place orders.
                  </span>
                ) : (
                  <span className="text-gray-600">
                    Polygon drawn ({polygonPoints.length} points), but "Enforce Boundary" is currently unchecked.
                  </span>
                )}
              </div>
              {testPin && (
                <div className={`font-semibold ${testPin.inside ? 'text-green-600' : 'text-red-600'}`}>
                  Test Pin ({testPin.lat}, {testPin.lng}): {testPin.inside ? 'INSIDE SERVICE AREA ✓' : 'OUTSIDE SERVICE AREA ✕'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalType && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">{editingId ? 'Edit' : 'Add'} {modalType === 'BANNER' ? 'Banner' : 'Category'}</h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-gray-800 cursor-pointer"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Custom Image Uploader */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
                {formData.image_url ? (
                  <div className="relative w-full h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain" />
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, image_url: ''})} 
                      className="absolute top-2 right-2 bg-white rounded-full text-red-500 hover:text-red-700 shadow-md p-1 cursor-pointer"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 font-medium">Click to upload image file</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
              
              {modalType === 'BANNER' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title (Internal)</label>
                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" placeholder="e.g. Summer Sale" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Redirect Type</label>
                      <select value={formData.redirect_type} onChange={e => setFormData({...formData, redirect_type: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white">
                        <option value="NONE">None</option>
                        <option value="RESTAURANT">Restaurant ID</option>
                        <option value="COUPON">Coupon Code</option>
                        <option value="SEARCH">Search Query</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                      <input type="text" value={formData.redirect_value} onChange={e => setFormData({...formData, redirect_value: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" placeholder="e.g. SAVE50 or Burger" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" placeholder="e.g. Pizzas" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Query Trigger</label>
                    <input type="text" value={formData.search_query} onChange={e => setFormData({...formData, search_query: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" placeholder="e.g. pizza" />
                  </div>
                </>
              )}

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" required value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" />
                </div>
                <div className="flex items-end mb-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-brand rounded focus:ring-brand" />
                    <span className="text-sm font-medium text-gray-700">Is Active</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setModalType(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 cursor-pointer font-medium">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}