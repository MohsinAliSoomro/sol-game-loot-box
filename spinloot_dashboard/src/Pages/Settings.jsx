import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { styled } from '@mui/material/styles';
import { TextField } from '@mui/material';
import { useLootboxes } from '../hooks/useLootboxes'

function Settings() {
  const navigate = useNavigate()
  const { lootboxes, loading, error, addLootbox, updateLootbox, deleteLootbox } = useLootboxes()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedType, setSelectedType] = useState('lootbox') // 'lootbox' or 'nft'
  const [editingItem, setEditingItem] = useState(null)
  

  const [formData, setFormData] = useState({
    type: 'lootbox',
    name: '',
    price: '',
    percent: '',
    image: null,
    rarity: '',
    description: '',
    rewardCount: 0
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    setFormData(prev => ({
      ...prev,
      image: file
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingItem) {
        // Update existing item
        await updateLootbox(editingItem.id, formData)
      } else {
        // Add new item
        await addLootbox(formData)
      }
      setShowAddModal(false)
      setFormData({
        type: 'lootbox',
        name: '',
        price: '',
        percent: '',
        image: null,
        rarity: '',
        description: '',
        rewardCount: 0
      })
      setEditingItem(null)
    } catch (error) {
      console.error('Error saving lootbox:', error)
      alert('Error saving lootbox. Please try again.')
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData(item)
    setShowAddModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this lootbox?')) {
      try {
        await deleteLootbox(id)
      } catch (error) {
        console.error('Error deleting lootbox:', error)
        alert('Error deleting lootbox. Please try again.')
      }
    }
  }


  const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
  });

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Lootbox Settings</h1>
          <p className="text-gray-600 mt-1">Manage your lootboxes and their rewards</p>
        </div>
        <button 
          onClick={() => {
            setShowAddModal(true)
            setEditingItem(null)
            setFormData({
              type: 'lootbox',
              name: '',
              price: '',
              percent: '',
              image: null,
              rarity: '',
              description: '',
              rewardCount: 0
            })
          }}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add New Lootbox</span>
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rarity
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rewards
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading lootboxes...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <p className="text-red-500">Error loading lootboxes: {error}</p>
                  </td>
                </tr>
              ) : lootboxes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <p className="text-gray-500">No lootboxes found. Add your first lootbox!</p>
                  </td>
                </tr>
              ) : (
                lootboxes.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-orange-50 cursor-pointer group"
                    onClick={() => navigate(`/lootbox/${item.id}/rewards`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                          {item.image ? (
                            <img 
                              src={`https://zkltmkbmzxvfovsgotpt.supabase.co/storage/v1/object/public/apes-bucket/${item.image}`}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <span className="text-gray-500 text-xs" style={{ display: item.image ? 'none' : 'flex' }}>IMG</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${item.price}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {item.rarity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.rewardCount} Rewards
                    </td>
                    <td
                      className="px-6 py-4 text-right"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => navigate(`/lootbox/${item.id}/rewards`)}
                          className="text-gray-400 hover:text-orange-500"
                          title="View Rewards"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleEdit(item)}
                          className="text-gray-400 hover:text-gray-500"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingItem ? 'Edit Lootbox' : 'Add New Lootbox'}
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Selection */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setSelectedType('lootbox')}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    selectedType === 'lootbox'
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Lootbox
                </button>
                {/* <button
                  type="button"
                  onClick={() => setSelectedType('nft')}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    selectedType === 'nft'
                      ? 'border-purple-500 bg-purple-50 text-purple-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  NFT
                </button> */}
              </div>

              {/* Common Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              {/* Lootbox Specific Fields */}
              {selectedType === 'lootbox' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Percent Chance</label>
                    <input
                      type="number"
                      name="percent"
                      value={formData.percent}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                </>
              )}

              {/* NFT Specific Fields */}
              {selectedType === 'nft' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                    rows="3"
                    required
                  />
                </div>
              )}

              {/* Common Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rarity</label>
                <select
                  name="rarity"
                  value={formData.rarity}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  required
                >
                  <option value="">Select Rarity</option>
                  <option value="Common">Common</option>
                  <option value="Uncommon">Uncommon</option>
                  <option value="Rare">Rare</option>
                  <option value="Epic">Epic</option>
                  <option value="Legendary">Legendary</option>
                  <option value="Mythic">Mythic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <input
                  type="file"
                  onChange={handleImageChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  accept="image/*"
                  required={!editingItem}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  {editingItem ? 'Save Changes' : 'Add Lootbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default Settings
