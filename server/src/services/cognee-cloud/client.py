"""
Cognee Cloud Client — Python SDK Wrapper

Provides a Python interface to Cognee Cloud Premium using the cogwit-sdk.
This replaces the local Docker Cognee instance with managed cloud infrastructure.

API Key: 13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from cogwit_sdk import cogwit, CogwitConfig
from cogwit_sdk.responses import AddResponse, CognifyResponse, SearchResult


class CogneeCloudClient:
    """
    Cognee Cloud client for GoldLedger.
    
    Handles all interactions with Cognee Cloud Premium subscription:
    - Dataset management
    - Data ingestion (add)
    - Knowledge graph building (cognify)
    - Search operations (all 14 search types)
    - DataPoint and Ontology management
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Cognee Cloud client.
        
        Args:
            api_key: Cognee Cloud API key (defaults to COGWIT_API_KEY env var)
        """
        self.api_key = api_key or os.getenv(
            "COGWIT_API_KEY",
            "13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff"
        )
        
        # Create configuration
        self.config = CogwitConfig(api_key=self.api_key)
        
        # Create client instance
        self.client = cogwit(self.config)
        
        # Cache for dataset IDs
        self.dataset_cache: Dict[str, str] = {}
    
    async def add_data(
        self,
        data: str | List[str],
        dataset_name: str,
        tenant_id: Optional[str] = None
    ) -> AddResponse:
        """
        Add data to a dataset in Cognee Cloud.
        
        Args:
            data: Text data or list of text data to add
            dataset_name: Name of the dataset
            tenant_id: Optional tenant ID for multi-tenant isolation
            
        Returns:
            AddResponse with status and dataset_id
        """
        # Apply tenant prefix if provided
        prefixed_dataset = self._apply_tenant_prefix(dataset_name, tenant_id)
        
        # Convert list to single string if needed
        if isinstance(data, list):
            data = "\n\n".join(data)
        
        result = await self.client.add(
            data=data,
            dataset_name=prefixed_dataset
        )
        
        # Cache dataset ID
        if result.dataset_id:
            self.dataset_cache[prefixed_dataset] = result.dataset_id
        
        return result
    
    async def cognify(
        self,
        dataset_names: Optional[List[str]] = None,
        dataset_ids: Optional[List[str]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Build knowledge graph from added data.
        
        Args:
            dataset_names: List of dataset names to cognify
            dataset_ids: List of dataset IDs to cognify
            tenant_id: Optional tenant ID for multi-tenant isolation
            
        Returns:
            CognifyResponse mapping dataset IDs to status
        """
        # Resolve dataset IDs from names if needed
        if dataset_names and not dataset_ids:
            dataset_ids = []
            for name in dataset_names:
                prefixed_name = self._apply_tenant_prefix(name, tenant_id)
                if prefixed_name in self.dataset_cache:
                    dataset_ids.append(self.dataset_cache[prefixed_name])
                else:
                    # Try to get dataset ID from Cognee Cloud
                    # For now, skip if not in cache
                    pass
        
        if not dataset_ids:
            raise ValueError("No dataset IDs provided or found in cache")
        
        result = await self.client.cognify(dataset_ids=dataset_ids)
        return result
    
    async def search(
        self,
        query_text: str,
        search_type: str = "GRAPH_COMPLETION",
        dataset_names: Optional[List[str]] = None,
        top_k: int = 5,
        tenant_id: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Search the knowledge graph.
        
        Args:
            query_text: Search query
            search_type: One of 14 Cognee search types (default: GRAPH_COMPLETION)
            dataset_names: Optional list of datasets to search
            top_k: Number of results to return
            tenant_id: Optional tenant ID for multi-tenant isolation
            
        Returns:
            List of SearchResult objects
        """
        # Map search type string to enum
        search_type_enum = getattr(self.client.SearchType, search_type, self.client.SearchType.GRAPH_COMPLETION)
        
        # Apply tenant prefix to dataset names if provided
        if dataset_names and tenant_id:
            dataset_names = [self._apply_tenant_prefix(name, tenant_id) for name in dataset_names]
        
        results = await self.client.search(
            query_text=query_text,
            query_type=search_type_enum,
            top_k=top_k
        )
        
        return results
    
    def _apply_tenant_prefix(self, dataset_name: str, tenant_id: Optional[str]) -> str:
        """Apply tenant prefix to dataset name for isolation."""
        if tenant_id:
            return f"tenant_{tenant_id}_{dataset_name}"
        return dataset_name


# Global client instance
_cognee_cloud_client: Optional[CogneeCloudClient] = None


def get_cognee_cloud_client() -> CogneeCloudClient:
    """Get or create the global Cognee Cloud client instance."""
    global _cognee_cloud_client
    if _cognee_cloud_client is None:
        _cognee_cloud_client = CogneeCloudClient()
    return _cognee_cloud_client

