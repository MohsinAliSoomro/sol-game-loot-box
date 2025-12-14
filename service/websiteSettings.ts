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

export const getWebsiteLogo = async (): Promise<string | null> => {
  try {
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

export const getThemeSettings = async (): Promise<ThemeSettings | null> => {
  try {
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

export const getSliderImages = async (): Promise<SliderImage[]> => {
  try {
    const { data, error } = await supabase
      .from("slider_images")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

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

export const getLootboxSettings = async (): Promise<LootboxSettings | null> => {
  try {
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

export const getWheelSettings = async (): Promise<WheelSettings | null> => {
  try {
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

