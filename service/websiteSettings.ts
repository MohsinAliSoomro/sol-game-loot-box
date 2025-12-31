import { supabase } from "./supabase";

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export interface SliderImage {
  id: string;
  image_path: string;
  order_index: number;
  is_active: boolean;
}

const supabaseUrl = "https://zkltmkbmzxvfovsgotpt.supabase.co";

export const getImageUrl = (path: string | null): string | null => {
  if (!path) return null;
  return `${supabaseUrl}/storage/v1/object/public/apes-bucket/${path}`;
};

export const getWebsiteLogo = async (projectId?: number | null): Promise<string | null> => {
  try {
    // If projectId is provided, fetch from project_settings (project-specific)
    if (projectId) {
      const { data, error } = await supabase
        .from("project_settings")
        .select("setting_value")
        .eq("project_id", projectId)
        .eq("setting_key", "logo")
        .single();

      if (error || !data?.setting_value) {
        return null;
      }

      return getImageUrl(data.setting_value);
    }

    // Fallback to website_settings for main project (legacy)
    const { data, error } = await supabase
      .from("website_settings")
      .select("value")
      .eq("key", "logo")
      .single();

    if (error || !data?.value) {
      return null;
    }

    return getImageUrl(data.value);
  } catch (error) {
    console.error("Error fetching website logo:", error);
    return null;
  }
};

export const getThemeSettings = async (projectId?: number | null): Promise<ThemeSettings | null> => {
  try {
    // If projectId is provided, fetch from project_settings (project-specific)
    if (projectId) {
      const { data, error } = await supabase
        .from("project_settings")
        .select("setting_value")
        .eq("project_id", projectId)
        .eq("setting_key", "theme")
        .single();

      if (error || !data?.setting_value) {
        return null;
      }

      // setting_value might be a JSON string or already an object
      const themeValue = typeof data.setting_value === 'string' 
        ? JSON.parse(data.setting_value) 
        : data.setting_value;
      
      return themeValue;
    }

    // Fallback to website_settings for main project (legacy)
    const { data, error } = await supabase
      .from("website_settings")
      .select("value")
      .eq("key", "theme")
      .single();

    if (error || !data?.value) {
      return null;
    }

    return JSON.parse(data.value);
  } catch (error) {
    console.error("Error fetching theme settings:", error);
    return null;
  }
};

export const getSliderImages = async (projectId?: number | null): Promise<SliderImage[]> => {
  try {
    let query = supabase
      .from("slider_images")
      .select("*")
      .eq("is_active", true);

    // Filter by project_id if provided (project-specific)
    if (projectId) {
      query = query.eq("project_id", projectId);
    } else {
      // For main project, only get images without project_id (legacy) or null project_id
      query = query.is("project_id", null);
    }

    const { data, error } = await query.order("order_index", { ascending: true });

    if (error) {
      console.error("Supabase error fetching slider images:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log("No slider images found in database");
      return [];
    }

    console.log("Raw slider images from database:", data); // Debug log

    const images = data.map((img) => {
      // image_path is the storage path, convert it to full URL
      const fullUrl = img.image_path ? getImageUrl(img.image_path) : null;
      return {
        ...img,
        image_path: fullUrl || img.image_path,
      };
    }) as SliderImage[];

    console.log("Processed slider images with URLs:", images); // Debug log
    return images;
  } catch (error) {
    console.error("Error fetching slider images:", error);
    return [];
  }
};

export interface LootboxSettings {
  boxBackgroundColor: string;
}

export const getLootboxSettings = async (projectId?: number | null): Promise<LootboxSettings | null> => {
  try {
    // If projectId is provided, fetch from project_settings (project-specific)
    if (projectId) {
      const { data, error } = await supabase
        .from("project_settings")
        .select("setting_value")
        .eq("project_id", projectId)
        .eq("setting_key", "lootbox")
        .single();

      if (error || !data?.setting_value) {
        return null;
      }

      // setting_value might be a JSON string or already an object
      const lootboxValue = typeof data.setting_value === 'string' 
        ? JSON.parse(data.setting_value) 
        : data.setting_value;
      
      return lootboxValue;
    }

    // Fallback to website_settings for main project (legacy)
    const { data, error } = await supabase
      .from("website_settings")
      .select("value")
      .eq("key", "lootbox")
      .single();

    if (error || !data?.value) {
      return null;
    }

    return JSON.parse(data.value);
  } catch (error) {
    console.error("Error fetching lootbox settings:", error);
    return null;
  }
};

export interface WheelSettings {
  segmentFillColor: string;
  segmentStrokeColor: string;
  buttonBackgroundColor: string;
  buttonHoverColor: string;
  pointerColor: string;
  textColor: string;
  backgroundImage?: string | null;
}

export const getWheelSettings = async (projectId?: number | null): Promise<WheelSettings | null> => {
  try {
    // If projectId is provided, fetch from project_settings (project-specific)
    if (projectId) {
      const { data, error } = await supabase
        .from("project_settings")
        .select("setting_value")
        .eq("project_id", projectId)
        .eq("setting_key", "wheel")
        .single();

      if (error || !data?.setting_value) {
        return null;
      }

      // setting_value might be a JSON string or already an object
      const wheelValue = typeof data.setting_value === 'string' 
        ? JSON.parse(data.setting_value) 
        : data.setting_value;
      
      return wheelValue;
    }

    // Fallback to website_settings for main project (legacy)
    const { data, error } = await supabase
      .from("website_settings")
      .select("value")
      .eq("key", "wheel")
      .single();

    if (error || !data?.value) {
      return null;
    }

    return JSON.parse(data.value);
  } catch (error) {
    console.error("Error fetching wheel settings:", error);
    return null;
  }
};

export const getFavicon = async (projectId?: number | null): Promise<string | null> => {
  try {
    // If projectId is provided, fetch from project_settings (project-specific)
    if (projectId) {
      const { data, error } = await supabase
        .from("project_settings")
        .select("setting_value")
        .eq("project_id", projectId)
        .eq("setting_key", "favicon")
        .single();

      if (error || !data?.setting_value) {
        return null;
      }

      return getImageUrl(data.setting_value);
    }

    // Fallback to website_settings for main project (legacy)
    const { data, error } = await supabase
      .from("website_settings")
      .select("value")
      .eq("key", "favicon")
      .single();

    if (error || !data?.value) {
      return null;
    }

    return getImageUrl(data.value);
  } catch (error) {
    console.error("Error fetching favicon:", error);
    return null;
  }
};

