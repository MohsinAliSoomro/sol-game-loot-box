"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';
import { useAdminWallet } from '@/lib/hooks/useAdminWallet';

// Predefined themes configuration
const predefinedThemes = {
  default: {
    name: 'Default Orange',
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Waltograph'
  },
  blue: {
    name: 'Modern Blue',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Waltograph'
  },
  purple: {
    name: 'Creative Purple',
    primaryColor: '#8B5CF6',
    secondaryColor: '#5B21B6',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Waltograph'
  },
  green: {
    name: 'Nature Green',
    primaryColor: '#10B981',
    secondaryColor: '#047857',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Waltograph'
  },
  vibrant: {
    name: 'Vibrant Pink',
    primaryColor: '#F472B6',
    secondaryColor: '#38BDF8',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Waltograph'
  }
};

const defaultTheme = {
  primaryColor: '#FF6B35',
  secondaryColor: '#004E89',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily: 'Waltograph'
};

export default function WebsiteSettings() {
  const { getProjectId, getProjectTokenSymbol } = useProject();
  const tokenSymbol = getProjectTokenSymbol();
  const projectId = getProjectId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(null);
  const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);
  const [sliderImages, setSliderImages] = useState<any[]>([]);
  const [sliderFile1, setSliderFile1] = useState<File | null>(null);
  const [sliderFile2, setSliderFile2] = useState<File | null>(null);
  const [sliderFile3, setSliderFile3] = useState<File | null>(null);
  const [sliderPreviewUrl1, setSliderPreviewUrl1] = useState<string | null>(null);
  const [sliderPreviewUrl2, setSliderPreviewUrl2] = useState<string | null>(null);
  const [sliderPreviewUrl3, setSliderPreviewUrl3] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Waltograph'
  });
  const [selectedThemeType, setSelectedThemeType] = useState<string>('default');
  const [lootboxBoxBg, setLootboxBoxBg] = useState('#FFFFFF');
  const [wheelSettings, setWheelSettings] = useState({
    segmentFillColor: '#ff914d',
    segmentStrokeColor: '#f74e14',
    buttonBackgroundColor: '#f74e14',
    buttonHoverColor: '#e63900',
    pointerColor: '#f74e14',
    textColor: '#ffffff',
    backgroundImage: null as string | null
  });
  const [wheelBgImageFile, setWheelBgImageFile] = useState<File | null>(null);
  const [currentWheelBgImage, setCurrentWheelBgImage] = useState<string | null>(null);
  
  // Admin wallet settings
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [adminPrivateKey, setAdminPrivateKey] = useState('');
  const [savingAdminKey, setSavingAdminKey] = useState(false);
  const { adminWalletAddress, loading: adminWalletLoading, error: adminWalletError, refreshAdminWallet } = useAdminWallet();
  
  // Deposit wallet settings
  const [depositWalletAddress, setDepositWalletAddress] = useState('');
  const [savingDepositWallet, setSavingDepositWallet] = useState(false);
  const [showDepositWalletSettings, setShowDepositWalletSettings] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchAdminKey();
    fetchDepositWallet();
  }, [projectId]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      if (sliderPreviewUrl1) {
        URL.revokeObjectURL(sliderPreviewUrl1);
      }
      if (sliderPreviewUrl2) {
        URL.revokeObjectURL(sliderPreviewUrl2);
      }
      if (sliderPreviewUrl3) {
        URL.revokeObjectURL(sliderPreviewUrl3);
      }
    };
  }, [logoPreviewUrl, sliderPreviewUrl1, sliderPreviewUrl2, sliderPreviewUrl3]);

  const fetchSettings = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // Fetch logo from project_settings (project-scoped) or website_settings (fallback)
      const { data: projectSettingsData } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'logo')
        .single();

      if (projectSettingsData?.setting_value) {
        setCurrentLogo(projectSettingsData.setting_value as string);
      } else {
        // Fallback to website_settings
        const { data: settingsData } = await supabase
          .from('website_settings')
          .select('*')
          .eq('key', 'logo')
          .single();
        if (settingsData) {
          setCurrentLogo(settingsData.value);
        }
      }

      // Fetch favicon from project_settings
      const { data: faviconData } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'favicon')
        .single();

      if (faviconData?.setting_value) {
        setCurrentFavicon(faviconData.setting_value as string);
      } else {
        // Fallback to website_settings
        const { data: settingsData } = await supabase
          .from('website_settings')
          .select('*')
          .eq('key', 'favicon')
          .single();
        if (settingsData) {
          setCurrentFavicon(settingsData.value);
        }
      }

      // Fetch slider images for this project (project-scoped)
      if (projectId) {
        const { data: slidersData } = await supabase
          .from('slider_images')
          .select('*')
          .eq('project_id', projectId)
          .order('order_index', { ascending: true });
        if (slidersData) {
          setSliderImages(slidersData);
        }
      }

      // Fetch theme settings from project_settings
      const { data: themeData } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'theme')
        .single();

      if (themeData?.setting_value) {
        const theme = themeData.setting_value as any;
        setThemeSettings(prev => ({ ...prev, ...theme }));
        const matchingTheme = Object.entries(predefinedThemes).find(([key, preset]) => 
          preset.primaryColor === theme.primaryColor &&
          preset.secondaryColor === theme.secondaryColor &&
          preset.fontFamily === theme.fontFamily
        );
        setSelectedThemeType(matchingTheme ? matchingTheme[0] : 'custom');
      } else {
        // Fallback to website_settings
        const { data: websiteThemeData } = await supabase
          .from('website_settings')
          .select('*')
          .eq('key', 'theme');
        if (websiteThemeData && websiteThemeData.length > 0) {
          const theme = JSON.parse(websiteThemeData[0].value || '{}');
          setThemeSettings(prev => ({ ...prev, ...theme }));
          const matchingTheme = Object.entries(predefinedThemes).find(([key, preset]) => 
            preset.primaryColor === theme.primaryColor &&
            preset.secondaryColor === theme.secondaryColor &&
            preset.fontFamily === theme.fontFamily
          );
          setSelectedThemeType(matchingTheme ? matchingTheme[0] : 'custom');
        }
      }

      // Fetch lootbox box background color
      const { data: lootboxData } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'lootbox')
        .single();

      if (lootboxData?.setting_value) {
        const lootbox = lootboxData.setting_value as any;
        if (lootbox.boxBackgroundColor) {
          setLootboxBoxBg(lootbox.boxBackgroundColor);
        }
      } else {
        // Fallback
        const { data: websiteLootboxData } = await supabase
          .from('website_settings')
          .select('*')
          .eq('key', 'lootbox');
        if (websiteLootboxData && websiteLootboxData.length > 0) {
          const lootbox = JSON.parse(websiteLootboxData[0].value || '{}');
          if (lootbox.boxBackgroundColor) {
            setLootboxBoxBg(lootbox.boxBackgroundColor);
          }
        }
      }

      // Fetch wheel theme settings
      const { data: wheelData } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'wheel')
        .single();

      if (wheelData?.setting_value) {
        const wheel = wheelData.setting_value as any;
        if (wheel.segmentFillColor || wheel.segmentStrokeColor || wheel.buttonBackgroundColor || wheel.backgroundImage) {
          setWheelSettings(prev => ({
            segmentFillColor: wheel.segmentFillColor || prev.segmentFillColor,
            segmentStrokeColor: wheel.segmentStrokeColor || prev.segmentStrokeColor,
            buttonBackgroundColor: wheel.buttonBackgroundColor || prev.buttonBackgroundColor,
            buttonHoverColor: wheel.buttonHoverColor || prev.buttonHoverColor,
            pointerColor: wheel.pointerColor || prev.pointerColor,
            textColor: wheel.textColor || prev.textColor,
            backgroundImage: wheel.backgroundImage || prev.backgroundImage
          }));
          if (wheel.backgroundImage) {
            setCurrentWheelBgImage(wheel.backgroundImage);
          }
        }
      } else {
        // Fallback
        const { data: websiteWheelData } = await supabase
          .from('website_settings')
          .select('*')
          .eq('key', 'wheel');
        if (websiteWheelData && websiteWheelData.length > 0) {
          const wheel = JSON.parse(websiteWheelData[0].value || '{}');
          if (wheel.segmentFillColor || wheel.segmentStrokeColor || wheel.buttonBackgroundColor || wheel.backgroundImage) {
            setWheelSettings(prev => ({
              segmentFillColor: wheel.segmentFillColor || prev.segmentFillColor,
              segmentStrokeColor: wheel.segmentStrokeColor || prev.segmentStrokeColor,
              buttonBackgroundColor: wheel.buttonBackgroundColor || prev.buttonBackgroundColor,
              buttonHoverColor: wheel.buttonHoverColor || prev.buttonHoverColor,
              pointerColor: wheel.pointerColor || prev.pointerColor,
              textColor: wheel.textColor || prev.textColor,
              backgroundImage: wheel.backgroundImage || prev.backgroundImage
            }));
            if (wheel.backgroundImage) {
              setCurrentWheelBgImage(wheel.backgroundImage);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (path: string | null): string | undefined => {
    if (!path) return undefined;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkltmkbmzxvfovsgotpt.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/apes-bucket/${path}`;
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !projectId) return;

    setSaving(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `website/logo/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('apes-bucket')
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Save to project_settings (project-scoped)
      const { error: dbError } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'logo',
          setting_value: filePath
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (dbError) throw dbError;

      setCurrentLogo(filePath);
      setLogoFile(null);
      // Clear preview URL after successful upload
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl(null);
      }
      alert('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Error uploading logo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFaviconUpload = async () => {
    if (!faviconFile || !projectId) return;

    setSaving(true);
    try {
      const fileExt = faviconFile.name.split('.').pop();
      const fileName = `favicon-${Date.now()}.${fileExt}`;
      const filePath = `website/favicon/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('apes-bucket')
        .upload(filePath, faviconFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Save to project_settings (project-scoped)
      const { error: dbError } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'favicon',
          setting_value: filePath
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (dbError) throw dbError;

      setCurrentFavicon(filePath);
      setFaviconFile(null);
      // Clear preview URL after successful upload
      if (faviconPreviewUrl) {
        URL.revokeObjectURL(faviconPreviewUrl);
        setFaviconPreviewUrl(null);
      }
      alert('Favicon uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading favicon:', error);
      alert('Error uploading favicon. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSliderUpload = async (slotNumber: number) => {
    if (!projectId) return;
    
    const file = slotNumber === 1 ? sliderFile1 : slotNumber === 2 ? sliderFile2 : sliderFile3;
    if (!file) return;

    setUploadingSlot(slotNumber);
    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `slider-${slotNumber}-${Date.now()}.${fileExt}`;
      const filePath = `website/slider/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('apes-bucket')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload image to storage');
      }

      // Check if image already exists for this slot in this project
      const { data: existingImages, error: checkError } = await supabase
        .from('slider_images')
        .select('*')
        .eq('project_id', projectId)
        .eq('order_index', slotNumber);

      if (checkError) {
        console.error('Error checking for existing slider image:', checkError);
        throw new Error(checkError.message || 'Failed to check for existing image');
      }

      const existingImage = existingImages && existingImages.length > 0 ? existingImages[0] : null;

      if (existingImage) {
        const { data, error: dbError } = await supabase
          .from('slider_images')
          .update({
            image_path: filePath,
            is_active: true
          })
          .eq('id', existingImage.id)
          .eq('project_id', projectId) // Ensure we only update this project's image
          .select();

        if (dbError) {
          console.error('Error updating slider image:', dbError);
          throw new Error(dbError.message || 'Failed to update slider image in database');
        }
        setSliderImages(prev => 
          prev.map(img => img.id === existingImage.id ? data[0] : img)
        );
      } else {
        const { data, error: dbError } = await supabase
          .from('slider_images')
          .insert([{
            image_path: filePath,
            order_index: slotNumber,
            is_active: true,
            project_id: projectId // Include project_id for project isolation
          }])
          .select();

        if (dbError) {
          console.error('Error inserting slider image:', dbError);
          throw new Error(dbError.message || 'Failed to save slider image to database');
        }
        setSliderImages(prev => {
          const updated = [...prev, data[0]];
          return updated.sort((a, b) => a.order_index - b.order_index);
        });
      }

      // Clear file and preview after successful upload
      if (slotNumber === 1) {
        setSliderFile1(null);
        if (sliderPreviewUrl1) {
          URL.revokeObjectURL(sliderPreviewUrl1);
          setSliderPreviewUrl1(null);
        }
      }
      if (slotNumber === 2) {
        setSliderFile2(null);
        if (sliderPreviewUrl2) {
          URL.revokeObjectURL(sliderPreviewUrl2);
          setSliderPreviewUrl2(null);
        }
      }
      if (slotNumber === 3) {
        setSliderFile3(null);
        if (sliderPreviewUrl3) {
          URL.revokeObjectURL(sliderPreviewUrl3);
          setSliderPreviewUrl3(null);
        }
      }
      
      alert(`Slider Image ${slotNumber} uploaded successfully!`);
      // Refresh the slider images list
      fetchSettings();
    } catch (error: any) {
      console.error('Error uploading slider image:', error);
      const errorMessage = error?.message || error?.error?.message || 'Unknown error occurred';
      alert(`Error uploading Slider Image ${slotNumber}: ${errorMessage}. Please try again.`);
    } finally {
      setSaving(false);
      setUploadingSlot(null);
    }
  };

  const handleDeleteSlider = async (id: string, imagePath: string) => {
    if (!projectId) return;
    
    if (!window.confirm('Are you sure you want to delete this slider image?')) {
      return;
    }

    setSaving(true);
    try {
      const { error: dbError } = await supabase
        .from('slider_images')
        .delete()
        .eq('id', id)
        .eq('project_id', projectId); // Ensure we only delete this project's slider

      if (dbError) throw dbError;

      setSliderImages(prev => prev.filter(img => img.id !== id));
      alert('Slider image deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting slider image:', error);
      alert('Error deleting slider image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeSave = async () => {
    if (!projectId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'theme',
          setting_value: themeSettings
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) throw error;
      alert('Theme settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving theme settings:', error);
      alert('Error saving theme settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetTheme = async () => {
    if (!window.confirm('Are you sure you want to reset theme settings to default? This cannot be undone.')) {
      return;
    }

    if (!projectId) return;
    
    setSaving(true);
    try {
      setThemeSettings(defaultTheme);
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'theme',
          setting_value: defaultTheme
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) throw error;
      alert('Theme settings reset to default successfully!');
    } catch (error: any) {
      console.error('Error resetting theme settings:', error);
      alert('Error resetting theme settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLootboxBoxBgSave = async () => {
    if (!projectId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'lootbox',
          setting_value: { boxBackgroundColor: lootboxBoxBg }
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) throw error;
      alert('Lootbox background color saved successfully!');
    } catch (error: any) {
      console.error('Error saving lootbox background color:', error);
      alert('Error saving lootbox background color. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleWheelBgImageUpload = async () => {
    if (!wheelBgImageFile || !projectId) return;

    setSaving(true);
    try {
      const fileExt = wheelBgImageFile.name.split('.').pop();
      const fileName = `wheel-bg-${Date.now()}.${fileExt}`;
      const filePath = `website/wheel/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('apes-bucket')
        .upload(filePath, wheelBgImageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const updatedWheelSettings = {
        ...wheelSettings,
        backgroundImage: filePath
      };

      const { error: dbError } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'wheel',
          setting_value: updatedWheelSettings
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (dbError) throw dbError;

      setWheelSettings(updatedWheelSettings);
      setCurrentWheelBgImage(filePath);
      setWheelBgImageFile(null);
      alert('Wheel background image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading wheel background image:', error);
      alert('Error uploading wheel background image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleWheelSave = async () => {
    if (!projectId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'wheel',
          setting_value: wheelSettings
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) throw error;
      alert('Wheel theme settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving wheel theme settings:', error);
      alert('Error saving wheel theme settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetWheel = async () => {
    if (!projectId) return;
    
    setSaving(true);
    try {
      const defaultWheelSettings = {
        segmentFillColor: '#ff914d',
        segmentStrokeColor: '#f74e14',
        buttonBackgroundColor: '#f74e14',
        buttonHoverColor: '#e63900',
        pointerColor: '#f74e14',
        textColor: '#ffffff',
        backgroundImage: wheelSettings.backgroundImage
      };

      setWheelSettings(defaultWheelSettings);

      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'wheel',
          setting_value: defaultWheelSettings
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) throw error;
      alert('Wheel theme settings reset to default successfully!');
    } catch (error: any) {
      console.error('Error resetting wheel theme settings:', error);
      alert('Error resetting wheel theme settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSliderOrderChange = async (id: string, newOrder: number) => {
    if (!projectId) return;
    
    try {
      const { error } = await supabase
        .from('slider_images')
        .update({ order_index: newOrder })
        .eq('id', id)
        .eq('project_id', projectId); // Ensure we only update this project's slider

      if (error) throw error;
      await fetchSettings();
    } catch (error: any) {
      console.error('Error updating slider order:', error);
      alert('Error updating slider order. Please try again.');
    }
  };

  const toggleSliderActive = async (id: string, currentActive: boolean) => {
    if (!projectId) return;
    
    try {
      const { error } = await supabase
        .from('slider_images')
        .update({ is_active: !currentActive })
        .eq('id', id)
        .eq('project_id', projectId); // Ensure we only update this project's slider

      if (error) throw error;

      setSliderImages(prev => 
        prev.map(img => 
          img.id === id ? { ...img, is_active: !currentActive } : img
        )
      );
    } catch (error: any) {
      console.error('Error toggling slider active status:', error);
      alert('Error updating slider status. Please try again.');
    }
  };

  const fetchAdminKey = async () => {
    if (!projectId) return;
    
    try {
      // Try project_settings first
      const { data } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'admin_private_key')
        .single();

      if (data?.setting_value) {
        setAdminPrivateKey(data.setting_value as string);
        try {
          const bs58 = (await import('bs58')).default;
          const { Keypair } = await import('@solana/web3.js');
          const privateKeyBytes = bs58.decode(data.setting_value as string);
          const keypair = Keypair.fromSecretKey(privateKeyBytes);
          // Wallet address is already loaded from useAdminWallet hook
        } catch (e) {
          console.error('Error deriving wallet address:', e);
        }
      } else {
        // Fallback to website_settings
        const { data: websiteData } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single();

        if (websiteData?.value) {
          setAdminPrivateKey(websiteData.value);
        }
      }
    } catch (error) {
      console.error('Error fetching admin key:', error);
    }
  };

  const handleSaveAdminKey = async () => {
    if (!adminPrivateKey || adminPrivateKey.trim() === '' || !projectId) {
      alert('Please enter admin private key');
      return;
    }

    try {
      const bs58 = (await import('bs58')).default;
      const { Keypair } = await import('@solana/web3.js');
      const privateKeyBytes = bs58.decode(adminPrivateKey.trim());
      const keypair = Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.publicKey.toString();
      
      setSavingAdminKey(true);
      
      // Save to project_settings (project-scoped)
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'admin_private_key',
          setting_value: adminPrivateKey.trim()
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) {
        console.error('Error saving admin key:', error);
        alert('Error saving admin private key. Please try again.');
        setSavingAdminKey(false);
        return;
      }

      await refreshAdminWallet();
      alert(`✅ Admin private key saved successfully!\n\nWallet Address: ${walletAddress}\n\nAll NFT and SOL withdrawals will now use this wallet.`);
      setShowAdminSettings(false);
      setSavingAdminKey(false);
    } catch (error: any) {
      console.error('Error validating private key:', error);
      alert('Invalid private key format. Please check and try again.');
      setSavingAdminKey(false);
    }
  };

  const fetchDepositWallet = async () => {
    if (!projectId) return;
    
    try {
      // Fetch deposit wallet address from project_settings
      const { data } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'deposit_wallet_address')
        .single();

      if (data?.setting_value) {
        setDepositWalletAddress(data.setting_value as string);
      }
    } catch (error) {
      console.error('Error fetching deposit wallet:', error);
    }
  };

  const handleSaveDepositWallet = async () => {
    if (!depositWalletAddress || depositWalletAddress.trim() === '' || !projectId) {
      alert('Please enter a valid wallet address');
      return;
    }

    try {
      // Validate wallet address format
      const { PublicKey } = await import('@solana/web3.js');
      try {
        new PublicKey(depositWalletAddress.trim());
      } catch (e) {
        alert('Invalid Solana wallet address format. Please check and try again.');
        return;
      }
      
      setSavingDepositWallet(true);
      
      // Save to project_settings (project-scoped)
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          project_id: projectId,
          setting_key: 'deposit_wallet_address',
          setting_value: depositWalletAddress.trim()
        }, {
          onConflict: 'project_id,setting_key'
        });

      if (error) {
        console.error('Error saving deposit wallet:', error);
        alert('Error saving deposit wallet address. Please try again.');
        setSavingDepositWallet(false);
        return;
      }

      alert(`✅ Deposit wallet address saved successfully!\n\nWallet Address: ${depositWalletAddress.trim()}\n\nAll SOL and token deposits will now be sent to this wallet.`);
      setShowDepositWalletSettings(false);
      setSavingDepositWallet(false);
      await fetchDepositWallet();
    } catch (error: any) {
      console.error('Error validating wallet address:', error);
      alert('Invalid wallet address format. Please check and try again.');
      setSavingDepositWallet(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Website Settings</h1>
        <p className="text-gray-600 mt-1">Manage your website logo, slider images, and theme settings</p>
      </div>

      <div className="space-y-6">
        {/* Logo Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Website Logo</h2>
          
          {/* Show preview if file is selected, otherwise show current logo */}
          {logoPreviewUrl ? (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Preview (New Logo):</p>
              <div className="inline-block p-4 bg-gray-50 rounded-lg border-2 border-orange-500 border-dashed">
                <img 
                  src={logoPreviewUrl} 
                  alt="Logo Preview" 
                  className="max-h-32 max-w-64 object-contain"
                />
              </div>
            </div>
          ) : currentLogo && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Current Logo:</p>
              <div className="inline-block p-4 bg-gray-50 rounded-lg border border-gray-200">
                <img 
                  src={getImageUrl(currentLogo)} 
                  alt="Current Logo" 
                  className="max-h-32 max-w-64 object-contain"
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setLogoFile(file);
                
                // Create preview URL for selected file
                if (file) {
                  // Clean up previous preview URL if exists
                  if (logoPreviewUrl) {
                    URL.revokeObjectURL(logoPreviewUrl);
                  }
                  const previewUrl = URL.createObjectURL(file);
                  setLogoPreviewUrl(previewUrl);
                } else {
                  // Clear preview if no file selected
                  if (logoPreviewUrl) {
                    URL.revokeObjectURL(logoPreviewUrl);
                    setLogoPreviewUrl(null);
                  }
                }
              }}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleLogoUpload}
              disabled={!logoFile || saving}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Uploading...' : 'Upload Logo'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Recommended size: 200x60px or larger, PNG/SVG format</p>
        </div>

        {/* Favicon Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Website Favicon</h2>
          <p className="text-sm text-gray-600 mb-4">Upload a favicon that will appear in browser tabs and bookmarks for your project.</p>
          
          {/* Show preview if file is selected, otherwise show current favicon */}
          {faviconPreviewUrl ? (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Preview (New Favicon):</p>
              <div className="inline-block p-4 bg-gray-50 rounded-lg border-2 border-orange-500 border-dashed">
                <img 
                  src={faviconPreviewUrl} 
                  alt="Favicon Preview" 
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>
          ) : currentFavicon && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Current Favicon:</p>
              <div className="inline-block p-4 bg-gray-50 rounded-lg border border-gray-200">
                <img 
                  src={getImageUrl(currentFavicon)} 
                  alt="Current Favicon" 
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept="image/x-icon,image/png,image/svg+xml,.ico"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setFaviconFile(file);
                
                // Create preview URL for selected file
                if (file) {
                  // Clean up previous preview URL if exists
                  if (faviconPreviewUrl) {
                    URL.revokeObjectURL(faviconPreviewUrl);
                  }
                  const previewUrl = URL.createObjectURL(file);
                  setFaviconPreviewUrl(previewUrl);
                } else {
                  // Clear preview if no file selected
                  if (faviconPreviewUrl) {
                    URL.revokeObjectURL(faviconPreviewUrl);
                    setFaviconPreviewUrl(null);
                  }
                }
              }}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleFaviconUpload}
              disabled={!faviconFile || saving}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Uploading...' : 'Upload Favicon'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Recommended size: 32x32px or 16x16px, ICO/PNG/SVG format. The favicon will appear in browser tabs.</p>
        </div>

        {/* Slider Images Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Landing Page Slider Images</h2>
          <p className="text-sm text-gray-600 mb-6">Upload up to 3 images for your slider. Each image will display in order (Image 1, Image 2, Image 3).</p>
          
          <div className="space-y-6">
            {[1, 2, 3].map((slotNumber) => {
              const currentImage = sliderImages.find(img => img.order_index === slotNumber);
              const fileState = slotNumber === 1 ? sliderFile1 : slotNumber === 2 ? sliderFile2 : sliderFile3;
              const setFileState = slotNumber === 1 ? setSliderFile1 : slotNumber === 2 ? setSliderFile2 : setSliderFile3;
              const previewUrl = slotNumber === 1 ? sliderPreviewUrl1 : slotNumber === 2 ? sliderPreviewUrl2 : sliderPreviewUrl3;
              const setPreviewUrl = slotNumber === 1 ? setSliderPreviewUrl1 : slotNumber === 2 ? setSliderPreviewUrl2 : setSliderPreviewUrl3;
              const isUploading = uploadingSlot === slotNumber;

              return (
                <div key={slotNumber} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {/* Show preview if file is selected, otherwise show current image or placeholder */}
                      {previewUrl ? (
                        <div className="relative">
                          <img 
                            src={previewUrl} 
                            alt={`Slider Image ${slotNumber} Preview`}
                            className="w-32 h-20 object-cover rounded-lg border-2 border-orange-500 border-dashed"
                          />
                          <span className="absolute bottom-0 left-0 right-0 bg-orange-500/80 text-white text-xs px-1 py-0.5 text-center">Preview</span>
                        </div>
                      ) : currentImage ? (
                        <div className="relative">
                          <img 
                            src={getImageUrl(currentImage.image_path)} 
                            alt={`Slider Image ${slotNumber}`}
                            className="w-32 h-20 object-cover rounded-lg border-2 border-orange-500"
                          />
                          <button
                            onClick={() => handleDeleteSlider(currentImage.id, currentImage.image_path)}
                            disabled={saving}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 disabled:bg-gray-400"
                            title="Delete image"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-20 bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <span className="text-xs text-gray-400">No image</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Image {slotNumber}
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setFileState(file);
                              
                              // Create preview URL for selected file
                              if (file) {
                                // Clean up previous preview URL if exists
                                if (previewUrl) {
                                  URL.revokeObjectURL(previewUrl);
                                }
                                const preview = URL.createObjectURL(file);
                                setPreviewUrl(preview);
                              } else {
                                // Clear preview if no file selected
                                if (previewUrl) {
                                  URL.revokeObjectURL(previewUrl);
                                  setPreviewUrl(null);
                                }
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 text-sm"
                            id={`slider-input-${slotNumber}`}
                          />
                          <button
                            onClick={() => handleSliderUpload(slotNumber)}
                            disabled={!fileState || saving}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                          >
                            {isUploading ? 'Uploading...' : currentImage ? 'Replace' : 'Upload'}
                          </button>
                        </div>
                      </div>
                      {currentImage && (
                        <p className="text-xs text-gray-500">
                          Active • Will display in slider position {slotNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-4">Recommended size: 1920x600px or larger, JPG/PNG format</p>
        </div>

        {/* Theme Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Theme Settings</h2>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Choose a Theme</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(predefinedThemes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedThemeType(key);
                    setThemeSettings(theme);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedThemeType === key
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className="flex space-x-1">
                      <div 
                        className="w-6 h-6 rounded" 
                        style={{ backgroundColor: theme.primaryColor }}
                      />
                      <div 
                        className="w-6 h-6 rounded" 
                        style={{ backgroundColor: theme.secondaryColor }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{theme.name}</span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setSelectedThemeType('custom')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedThemeType === 'custom'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className="flex space-x-1">
                    <div className="w-6 h-6 rounded bg-gradient-to-r from-purple-400 to-pink-400" />
                    <div className="w-6 h-6 rounded bg-gradient-to-r from-blue-400 to-cyan-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">Custom</span>
                </div>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedThemeType === 'custom' 
                ? 'You can customize all colors and fonts below.' 
                : `Selected: ${predefinedThemes[selectedThemeType as keyof typeof predefinedThemes]?.name || 'Custom'}. Click any color to customize.`}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={themeSettings.primaryColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={themeSettings.primaryColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#FF6B35"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={themeSettings.secondaryColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, secondaryColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={themeSettings.secondaryColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, secondaryColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#004E89"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={themeSettings.backgroundColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, backgroundColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={themeSettings.backgroundColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, backgroundColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={themeSettings.textColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, textColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={themeSettings.textColor}
                  onChange={(e) => {
                    setThemeSettings(prev => ({ ...prev, textColor: e.target.value }));
                    setSelectedThemeType('custom');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#1F2937"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
              <select
                value={themeSettings.fontFamily}
                onChange={(e) => {
                  setThemeSettings(prev => ({ ...prev, fontFamily: e.target.value }));
                  setSelectedThemeType('custom');
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
              >
                <option value="Waltograph">Waltograph (Default)</option>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Poppins">Poppins</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>
          </div>

          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Theme Preview:</p>
            <div 
              className="p-4 rounded-lg"
              style={{
                backgroundColor: themeSettings.backgroundColor,
                color: themeSettings.textColor,
                fontFamily: themeSettings.fontFamily
              }}
            >
              <div className="flex items-center space-x-4 mb-3">
                <button
                  className="px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: themeSettings.primaryColor,
                    color: '#FFFFFF'
                  }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-2 rounded-lg border-2"
                  style={{
                    borderColor: themeSettings.secondaryColor,
                    color: themeSettings.secondaryColor,
                    backgroundColor: 'transparent'
                  }}
                >
                  Secondary Button
                </button>
              </div>
              <p className="text-sm">This is how your theme will look on the website.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleThemeSave}
              disabled={saving}
              className="flex-1 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Theme Settings'}
            </button>
            <button
              onClick={handleResetTheme}
              disabled={saving}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Resetting...' : 'Reset to Default'}
            </button>
          </div>
        </div>

        {/* Lootbox Box Background Color Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Lootbox Box Background Color</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Box Background Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={lootboxBoxBg}
                onChange={(e) => setLootboxBoxBg(e.target.value)}
                className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={lootboxBoxBg}
                onChange={(e) => setLootboxBoxBg(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                placeholder="#FFFFFF"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">This will change the background color of the lootbox cards</p>
          </div>

          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Preview:</p>
            <div 
              className="rounded-lg shadow-md p-4 max-w-xs border border-orange-300"
              style={{
                backgroundColor: lootboxBoxBg
              }}
            >
              <div className="font-bold text-center py-2 px-3 text-xs rounded-lg shadow-lg mb-3 flex justify-center items-center bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white">
                REWARD 1
              </div>
              <div className="w-full h-20 bg-gray-200 rounded mb-3 flex items-center justify-center">
                <span className="text-gray-400 text-xs">Chest Image</span>
              </div>
              <button className="w-full py-2 text-xs rounded-lg shadow-lg font-medium flex justify-center items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white">
                OPEN 10
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleLootboxBoxBgSave}
              disabled={saving}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Background Color'}
            </button>
          </div>
        </div>

        {/* Wheel Theme Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Wheel Theme Settings</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Segment Fill Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={wheelSettings.segmentFillColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, segmentFillColor: e.target.value }))}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={wheelSettings.segmentFillColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, segmentFillColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#ff914d"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Segment Stroke Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={wheelSettings.segmentStrokeColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, segmentStrokeColor: e.target.value }))}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={wheelSettings.segmentStrokeColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, segmentStrokeColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#f74e14"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Button Background Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={wheelSettings.buttonBackgroundColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, buttonBackgroundColor: e.target.value }))}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={wheelSettings.buttonBackgroundColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, buttonBackgroundColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#f74e14"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Button Hover Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={wheelSettings.buttonHoverColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, buttonHoverColor: e.target.value }))}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={wheelSettings.buttonHoverColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, buttonHoverColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#e63900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pointer/Indicator Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={wheelSettings.pointerColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, pointerColor: e.target.value }))}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={wheelSettings.pointerColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, pointerColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#f74e14"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Text Color (on wheel)</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={wheelSettings.textColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, textColor: e.target.value }))}
                  className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={wheelSettings.textColor}
                  onChange={(e) => setWheelSettings(prev => ({ ...prev, textColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Wheel Background Image</label>
              <div className="space-y-3">
                {currentWheelBgImage && (
                  <div className="relative">
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkltmkbmzxvfovsgotpt.supabase.co'}/storage/v1/object/public/apes-bucket/${currentWheelBgImage}`}
                      alt="Current wheel background"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setWheelBgImageFile(e.target.files?.[0] || null)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 text-sm"
                  />
                  <button
                    onClick={handleWheelBgImageUpload}
                    disabled={!wheelBgImageFile || saving}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {saving ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">Upload a background image for the wheel. Recommended size: 1920x1080px</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Preview:</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div 
                className="w-20 h-20 rounded-full border-4"
                style={{
                  backgroundColor: wheelSettings.segmentFillColor,
                  borderColor: wheelSettings.segmentStrokeColor
                }}
              />
              <button
                className="px-4 py-2 rounded-lg text-white font-medium transition-colors"
                style={{
                  backgroundColor: wheelSettings.buttonBackgroundColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = wheelSettings.buttonHoverColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = wheelSettings.buttonBackgroundColor;
                }}
              >
                SPIN FOR 10 {tokenSymbol}
              </button>
              <div 
                className="w-0 h-0 border-l-4 border-r-4 border-t-8"
                style={{
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: wheelSettings.pointerColor
                }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={handleWheelSave}
              disabled={saving}
              className="flex-1 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Wheel Theme'}
            </button>
            <button
              onClick={handleResetWheel}
              disabled={saving}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Resetting...' : 'Reset to Default'}
            </button>
          </div>
        </div>

        {/* Admin Wallet Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Admin Wallet Settings</h2>
              <p className="text-sm text-gray-600 mt-1">Configure the wallet used for NFT and SOL withdrawals</p>
            </div>
            <button
              onClick={() => setShowAdminSettings(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Configure Wallet</span>
            </button>
          </div>

          {adminWalletAddress && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>✅ Current Admin Wallet:</strong>
              </p>
              <p className="text-xs font-mono text-green-700 mt-1 break-all">
                {adminWalletAddress}
              </p>
              <p className="text-xs text-green-600 mt-2">
                All NFT and SOL withdrawals will be processed from this wallet.
              </p>
            </div>
          )}

          {!adminWalletAddress && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ No Admin Wallet Configured</strong>
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Please configure an admin wallet to enable NFT and SOL withdrawals.
              </p>
            </div>
          )}
        </div>

        {/* Deposit Wallet Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Deposit Wallet Settings</h2>
              <p className="text-sm text-gray-600 mt-1">Configure the wallet address where SOL and token deposits will be received</p>
            </div>
            <button
              onClick={() => setShowDepositWalletSettings(true)}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Configure Deposit Wallet</span>
            </button>
          </div>

          {depositWalletAddress && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>✅ Current Deposit Wallet:</strong>
              </p>
              <p className="text-xs font-mono text-green-700 mt-1 break-all">
                {depositWalletAddress}
              </p>
              <p className="text-xs text-green-600 mt-2">
                All SOL and token deposits from users will be sent to this wallet address.
              </p>
            </div>
          )}

          {!depositWalletAddress && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ No Deposit Wallet Configured</strong>
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Please configure a deposit wallet address. If not configured, deposits will use the default platform wallet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Wallet Settings Modal */}
      {showAdminSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Admin Wallet Settings</h2>
              <button 
                onClick={() => setShowAdminSettings(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> This private key will be used for all NFT and SOL withdrawals. 
                  Make sure to keep it secure and never share it publicly.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Private Key (Base58)
                </label>
                <input
                  type="password"
                  value={adminPrivateKey}
                  onChange={(e) => setAdminPrivateKey(e.target.value)}
                  placeholder="Enter your Solana private key (Base58 format)"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This key will be stored securely in the database and used for all reward withdrawals.
                </p>
              </div>

              {adminWalletAddress && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>✅ Current Wallet Address:</strong>
                  </p>
                  <p className="text-xs font-mono text-green-700 mt-1 break-all">
                    {adminWalletAddress}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdminSettings(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAdminKey}
                  disabled={savingAdminKey || !adminPrivateKey.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {savingAdminKey ? 'Saving...' : 'Save Admin Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Wallet Settings Modal */}
      {showDepositWalletSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Deposit Wallet Settings</h2>
              <button 
                onClick={() => setShowDepositWalletSettings(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Information:</strong> This is the wallet address where all SOL and token deposits from users will be sent. 
                  You only need to provide the public wallet address (not the private key).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Wallet Address (Public Key)
                </label>
                <input
                  type="text"
                  value={depositWalletAddress}
                  onChange={(e) => setDepositWalletAddress(e.target.value)}
                  placeholder="Enter Solana wallet address (e.g., 5arqJxyZFKf4UCCL9JXa1nf79J4kkxzAXNu2icRfnBB6)"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This wallet will receive all SOL and token deposits from users. Make sure you have access to this wallet.
                </p>
              </div>

              {depositWalletAddress && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-800">
                    <strong>Wallet Address Preview:</strong>
                  </p>
                  <p className="text-xs font-mono text-gray-700 mt-1 break-all">
                    {depositWalletAddress}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDepositWalletSettings(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDepositWallet}
                  disabled={savingDepositWallet || !depositWalletAddress.trim()}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {savingDepositWallet ? 'Saving...' : 'Save Deposit Wallet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

