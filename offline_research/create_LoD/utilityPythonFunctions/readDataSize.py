import os
import re
import sys  # <--- IMPORTED FOR ARGUMENTS

def format_size(bytes_in):
    """Converts a file size in bytes to a human-readable string."""
    if bytes_in == 0:
        return "0 B"
    
    sizes = ("B", "KB", "MB", "GB", "TB")
    i = 0
    d_bytes = float(bytes_in)

    while d_bytes >= 1024 and i < len(sizes) - 1:
        d_bytes /= 1024
        i += 1

    return f"{d_bytes:.2f} {sizes[i]}"

def analyze_lod_sizes(base_path):
    """
    Scans a directory for frameXXXX folders and calculates
    the average size for each LOD file within them.
    """
    
    folder_pattern = re.compile(r'^frame\d{4}$')
    num_lods = 15
    
    lod_totals = [0] * num_lods
    lod_counts = [0] * num_lods

    print(f"Scanning for 'frameXXXX' folders in: {base_path}\n")

    # --- 1. Find all matching folders ---
    try:
        all_items_in_dir = os.listdir(base_path)
    except FileNotFoundError:
        print(f"Error: Directory not found.")
        print(f"Please check the path: {base_path}")
        return
    except Exception as e:
        print(f"Error: Could not read directory. {e}")
        return

    frame_folders = []
    for item in all_items_in_dir:
        full_item_path = os.path.join(base_path, item)
        if os.path.isdir(full_item_path) and folder_pattern.match(item):
            frame_folders.append(item)

    if not frame_folders:
        print("Error: No folders matching the pattern 'frameXXXX' were found.")
        return

    print(f"Found {len(frame_folders)} matching frame folders. Processing...\n")
    
    # --- 2. Go through each folder and gather data ---
    for folder_name in frame_folders:
        for i in range(num_lods):
            file_name = f"LOD{i}.drc"
            full_path = os.path.join(base_path, folder_name, file_name)
            
            try:
                file_size = os.path.getsize(full_path)
                lod_totals[i] += file_size
                lod_counts[i] += 1
            except FileNotFoundError:
                pass 
            except Exception as e:
                print(f"Warning: Could not read file {full_path}: {e}")

    # --- 3. Calculate and print the averages ---
    print("--- 📊 Average File Size per LOD ---")
    
    for i in range(num_lods):
        if lod_counts[i] > 0:
            average_size = lod_totals[i] / lod_counts[i]
            print(f"**LOD {i}**: "
                  f"Average = **{format_size(average_size)}** "
                  f"(Total: {format_size(lod_totals[i])} from {lod_counts[i]} files)")
        else:
            print(f"**LOD {i}**: No files found.")
            
    print("\nScan complete.")

# --- Main part of the script ---
if __name__ == "__main__":
    # --- MODIFIED: Read from command-line arguments ---
    if len(sys.argv) < 2:
        # If no argument is provided, print usage and exit
        print(f"Error: No path provided.")
        print(f"Usage: python {sys.argv[0]} <path_to_data_directory>")
        sys.exit(1) # Exit with a non-zero status to indicate an error

    # The first argument (sys.argv[0]) is the script name,
    # the second (sys.argv[1]) is the path we want.
    base_path_input = sys.argv[1]
    
    # 2. Clean up the path (removes extra spaces or quotes)
    clean_path = base_path_input.strip().strip("'\"")
    
    # 3. Run the analysis
    analyze_lod_sizes(clean_path)