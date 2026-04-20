import { supabase } from '@/app/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

const BUCKET_NAME = 'restaurant-images';

async function pickAndUpload(options: {
  aspect: [number, number];
  filePrefix?: string;
}): Promise<string | null> {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: options.aspect,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const uri = result.assets[0].uri;
    const prefix = options.filePrefix ? `${options.filePrefix}-` : '';
    const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      if (error.message?.includes('bucket') || error.message?.includes('not found')) {
        Alert.alert(
          'Storage Not Configured',
          'Please create a storage bucket named "restaurant-images" in your Supabase dashboard with public access enabled.'
        );
      } else {
        Alert.alert('Upload Failed', error.message || 'Failed to upload image');
      }
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Image pick/upload error:', error);
    Alert.alert('Error', 'Failed to upload image. Please try again.');
    return null;
  }
}

export function pickAndUploadImage(): Promise<string | null> {
  return pickAndUpload({ aspect: [1, 1] });
}

export function pickAndUploadHeroImage(): Promise<string | null> {
  return pickAndUpload({ aspect: [16, 9], filePrefix: 'hero' });
}
