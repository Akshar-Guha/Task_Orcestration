import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

// Initialize Supabase client with service role for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/diary/images - Upload an image for a diary entry
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entryId = formData.get('entryId') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 400 }
      );
    }

    // Verify entry belongs to user
    const { data: entry, error: entryError } = await supabase
      .from('daily_entries')
      .select('id, date')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single();

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Generate storage path: userId/YYYY-MM-DD/filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `${userId}/${entry.date}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('diary-images')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Images API] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Save metadata to images table
    const { data: imageRecord, error: dbError } = await supabase
      .from('images')
      .insert({
        entry_id: entryId,
        user_id: userId,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        caption: caption || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Images API] DB error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('diary-images').remove([storagePath]);
      return NextResponse.json({ error: 'Failed to save image metadata' }, { status: 500 });
    }

    // Get public URL (or signed URL for private buckets)
    const { data: urlData } = supabase.storage
      .from('diary-images')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord.id,
        storagePath: imageRecord.storage_path,
        originalFilename: imageRecord.original_filename,
        mimeType: imageRecord.mime_type,
        sizeBytes: imageRecord.size_bytes,
        caption: imageRecord.caption,
        url: urlData.publicUrl,
        createdAt: imageRecord.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Images API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/diary/images?entryId=uuid - Get images for a diary entry
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entryId');

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    // Verify entry belongs to user
    const { data: entry, error: entryError } = await supabase
      .from('daily_entries')
      .select('id')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single();

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Get images
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true });

    if (imagesError) {
      console.error('[Images API] Error fetching images:', imagesError);
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
    }

    // Add URLs
    const imagesWithUrls = (images || []).map((img) => {
      const { data: urlData } = supabase.storage
        .from('diary-images')
        .getPublicUrl(img.storage_path);

      return {
        id: img.id,
        storagePath: img.storage_path,
        originalFilename: img.original_filename,
        mimeType: img.mime_type,
        sizeBytes: img.size_bytes,
        caption: img.caption,
        url: urlData.publicUrl,
        createdAt: img.created_at,
      };
    });

    return NextResponse.json({ images: imagesWithUrls });
  } catch (error) {
    console.error('[Images API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/diary/images?id=uuid - Delete an image
export async function DELETE(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('id');

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    // Get image with entry to verify ownership
    const { data: image, error: imageError } = await supabase
      .from('images')
      .select('*, daily_entries!inner(user_id)')
      .eq('id', imageId)
      .single();

    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Verify ownership through entry
    if ((image.daily_entries as { user_id: string }).user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('diary-images')
      .remove([image.storage_path]);

    if (storageError) {
      console.error('[Images API] Storage delete error:', storageError);
      // Continue to delete DB record even if storage delete fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('images')
      .delete()
      .eq('id', imageId);

    if (dbError) {
      console.error('[Images API] DB delete error:', dbError);
      return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Images API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
