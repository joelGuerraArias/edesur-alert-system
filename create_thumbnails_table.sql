-- Crear tabla para almacenar thumbnails de videos
CREATE TABLE IF NOT EXISTS video_thumbnails (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  thumbnail_data TEXT NOT NULL,
  timestamp DECIMAL(10,3),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por video_id
CREATE INDEX IF NOT EXISTS idx_video_thumbnails_video_id ON video_thumbnails(video_id);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_video_thumbnails_updated_at 
    BEFORE UPDATE ON video_thumbnails 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentar la tabla
COMMENT ON TABLE video_thumbnails IS 'Almacena thumbnails personalizados capturados de videos';
COMMENT ON COLUMN video_thumbnails.video_id IS 'ID del video al que pertenece el thumbnail';
COMMENT ON COLUMN video_thumbnails.thumbnail_data IS 'Imagen del thumbnail en formato base64 (data URL)';
COMMENT ON COLUMN video_thumbnails.timestamp IS 'Momento exacto del video donde se capturó el frame (en segundos)';
