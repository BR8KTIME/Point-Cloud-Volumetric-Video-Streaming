#!/bin/bash

# --- Configuration ---
# IMPORTANT: Set the full, absolute path to your draco_encoder executable.
DRACO_ENCODER_PATH="../../draco/build/draco_encoder"

# --- Script Logic ---

# Check if source and destination directories were provided.
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <source_directory> <destination_directory>"
    exit 1
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2"

# Verify that the draco_encoder executable exists.
if [ ! -x "$DRACO_ENCODER_PATH" ]; then
    echo "Error: draco_encoder not found or not executable at '$DRACO_ENCODER_PATH'"
    echo "Please update the DRACO_ENCODER_PATH variable in the script."
    exit 1
fi

echo "Starting Draco encoding..."
echo "Source:      $INPUT_DIR"
echo "Destination: $OUTPUT_DIR"
echo "----------------------------------------"

# Find all .ply files in the source directory and its subdirectories.
find "$INPUT_DIR" -type f -name "*.ply" -print0 | sort -z | while IFS= read -r -d '' ply_file; do
    
    # 1. Get the path relative to the source directory (e.g., "frame10/level3.ply").
    relative_path="${ply_file#$INPUT_DIR}"

    # 2. Define the final output .drc file path (e.g., "output_dir/frame10/level3.drc").
    drc_file="$OUTPUT_DIR${relative_path%.ply}.drc"

    # 3. Get the destination directory path (e.g., "output_dir/frame10").
    dest_dir=$(dirname "$drc_file")

    # 4. Create the destination subdirectory if it doesn't exist.
    mkdir -p "$dest_dir"

    echo "Input:  $ply_file"
    echo "Output: $drc_file"

    # 5. Execute the draco_encoder.
    "$DRACO_ENCODER_PATH" -point_cloud -i "$ply_file" -o "$drc_file" --preserve_order

    echo "----------------------------------------"
done

echo "Batch encoding complete."