#!/usr/bin/env python3
"""
Initialize all datasets in Cognee Cloud.

Creates all 39 datasets (6 shared + 33 tenant) in Cognee Cloud Premium.
Run this script once to set up the knowledge graph infrastructure.

Usage:
    python -m server.src.services.cognee-cloud.init_datasets
"""

import asyncio
import sys
from typing import List
from client import get_cognee_cloud_client
from datasets import get_shared_datasets, get_tenant_datasets, DatasetDefinition


async def create_dataset(client, dataset: DatasetDefinition) -> bool:
    """
    Create a single dataset in Cognee Cloud.
    
    Args:
        client: CogneeCloudClient instance
        dataset: DatasetDefinition to create
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"Creating dataset: {dataset.name}")
        print(f"  Description: {dataset.description}")
        print(f"  Category: {dataset.category}")
        print(f"  Public: {dataset.is_public}")
        
        # Add a placeholder document to create the dataset
        # Cognee Cloud creates datasets on first add() call
        result = await client.add_data(
            data=f"# {dataset.name}\n\n{dataset.description}\n\nThis is a placeholder document to initialize the dataset.",
            dataset_name=dataset.name
        )
        
        print(f"  ✅ Created: {result.dataset_id}")
        print(f"  Status: {result.status}")
        print()
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        print()
        return False


async def create_all_datasets():
    """Create all datasets in Cognee Cloud."""
    print("=" * 80)
    print("Cognee Cloud Dataset Initialization")
    print("=" * 80)
    print()
    
    client = get_cognee_cloud_client()
    
    # Get all datasets
    shared_datasets = get_shared_datasets()
    tenant_datasets = get_tenant_datasets()
    
    print(f"📊 Total datasets to create: {len(shared_datasets) + len(tenant_datasets)}")
    print(f"   - Shared (public): {len(shared_datasets)}")
    print(f"   - Per-tenant: {len(tenant_datasets)}")
    print()
    
    # Create shared datasets
    print("=" * 80)
    print("SHARED DATASETS (Public Knowledge)")
    print("=" * 80)
    print()
    
    shared_success = 0
    for dataset in shared_datasets:
        if await create_dataset(client, dataset):
            shared_success += 1
    
    print(f"✅ Shared datasets created: {shared_success}/{len(shared_datasets)}")
    print()
    
    # Create tenant datasets (without tenant prefix for now)
    print("=" * 80)
    print("TENANT DATASETS (Per-User Financial Data)")
    print("=" * 80)
    print()
    
    tenant_success = 0
    for dataset in tenant_datasets:
        if await create_dataset(client, dataset):
            tenant_success += 1
    
    print(f"✅ Tenant datasets created: {tenant_success}/{len(tenant_datasets)}")
    print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total datasets created: {shared_success + tenant_success}/{len(shared_datasets) + len(tenant_datasets)}")
    print()
    
    if shared_success + tenant_success == len(shared_datasets) + len(tenant_datasets):
        print("🎉 All datasets created successfully!")
        return 0
    else:
        print("⚠️  Some datasets failed to create. Check errors above.")
        return 1


async def test_connection():
    """Test connection to Cognee Cloud."""
    print("Testing connection to Cognee Cloud...")
    print()
    
    try:
        client = get_cognee_cloud_client()
        
        # Try a simple add operation
        result = await client.add_data(
            data="Test connection to Cognee Cloud",
            dataset_name="test_connection"
        )
        
        print(f"✅ Connection successful!")
        print(f"   Dataset ID: {result.dataset_id}")
        print(f"   Status: {result.status}")
        print()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        print()
        return False


async def main():
    """Main entry point."""
    # Test connection first
    if not await test_connection():
        print("❌ Cannot connect to Cognee Cloud. Check your API key.")
        return 1
    
    # Create all datasets
    return await create_all_datasets()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

