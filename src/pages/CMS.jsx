import { useState, useEffect } from 'react';
import { Image, LayoutGrid, Plus, Trash2, Edit, Loader2, XCircle, Upload } from 'lucide-react';
import api from '../config/api';

export default function CMS() {
  const [activeTab, setActiveTab] = useState('BANNERS');
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modal State
  const [modalType, setModalType] = useState(null); // 'BANNER' | 'CATEGORY' | null
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  const fetchData = async () => {
    try {
      const [bannersRes, categoriesRes] = await Promise.all([
        api.get('/admin/banners'),
        api.get('/admin/categories')
      ]);
      setBanners(bannersRes.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      console.error("Failed to fetch CMS data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
          <h2 className="text-2xl font-bold text-gray-800">App CMS Manager</h2>
          <p className="text-gray-500">Control customer app layout, banners, and categories.</p>
        </div>
        <button 
          onClick={() => openModal(activeTab.slice(0, -1))} 
          className="flex items-center px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" /> Add {activeTab === 'BANNERS' ? 'Banner' : 'Category'}
        </button>
      </div>

      <div className="flex space-x-2 border-b border-gray-200">
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