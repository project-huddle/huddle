ALTER TABLE "users"
  ADD COLUMN "audio_input_device_id" VARCHAR(512),
  ADD COLUMN "audio_output_device_id" VARCHAR(512),
  ADD COLUMN "video_input_device_id" VARCHAR(512);
