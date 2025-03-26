'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DiagnosisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientChecks, setClientChecks] = useState<Record<string, any>>({
    status: 'pending',
    details: {}
  });

  useEffect(() => {
    // Run server-side diagnostics
    fetch('/api/diagnosis')
      .then(response => {
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setResults(data);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });

    // Run client-side diagnostics
    runClientChecks();
  }, []);

  const runClientChecks = async () => {
    const checks: Record<string, any> = {
      status: 'checking',
      details: {}
    };

    // Check if D3 is loaded
    checks.details.d3Loaded = typeof window !== 'undefined' && 'window.d3' in window;

    // Check for visualization SVG
    if (typeof document !== 'undefined') {
      const svgElement = document.querySelector('.visualization-container svg');
      checks.details.svgExists = !!svgElement;

      if (svgElement) {
        const width = svgElement.getAttribute('width');
        const height = svgElement.getAttribute('height');
        checks.details.svgDimensions = { width, height };

        const nodes = svgElement.querySelectorAll('.node');
        const links = svgElement.querySelectorAll('.link');
        checks.details.nodeCount = nodes.length;
        checks.details.linkCount = links.length;
      }
    }

    // Fetch data from API to check format
    try {
      const response = await fetch('/api/socialgraph');
      if (!response.ok) {
        checks.details.apiStatus = 'error';
        checks.details.apiMessage = `API returned status ${response.status}`;
      } else {
        const data = await response.json();
        checks.details.apiStatus = 'success';
        checks.details.dataValid = !!(data && data.nodes && data.links);
        checks.details.nodeCount = data.nodes?.length || 0;
        checks.details.linkCount = data.links?.length || 0;
      }
    } catch (error) {
      checks.details.apiStatus = 'error';
      checks.details.apiMessage = (error as Error).message;
    }

    // Set overall status
    if (
      checks.details.apiStatus === 'error' ||
      (checks.details.svgExists && !checks.details.nodeCount)
    ) {
      checks.status = 'error';
      checks.message = 'Issues detected with client-side visualization';
    } else if (!checks.details.svgExists) {
      checks.status = 'warning';
      checks.message = 'SVG not found - visualization may not be rendering';
    } else {
      checks.status = 'success';
      checks.message = 'Client-side checks passed';
    }

    setClientChecks(checks);
  };

  const runBrowserDiagnostic = () => {
    // Use the diagnosis API endpoint directly instead of injecting scripts
    fetch('/api/diagnosis/browser', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        userAgent: navigator.userAgent,
        screenSize: { 
          width: window.innerWidth, 
          height: window.innerHeight 
        }
      })
    })
    .then(response => response.json())
    .then(data => {
      // Display results in a modal or in the diagnostic results section
      if (data.success) {
        setClientChecks(prevState => ({
          ...prevState,
          browserResults: data.results
        }));
      } else {
        setError(`Browser diagnostic failed: ${data.error}`);
      }
    })
    .catch(err => {
      setError(`Browser diagnostic error: ${err.message}`);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Social Graph Diagnosis</h1>
      
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Running diagnostics...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>Error:</strong> {error}</p>
          <p className="mt-2">Please try again or check the server logs.</p>
        </div>
      ) : (
        <div>
          {/* Quick Actions */}
          <div className="mb-8 flex gap-4 flex-wrap">
            <button 
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={runBrowserDiagnostic}
            >
              Run Browser Diagnostic
            </button>
            <Link 
              href="/community" 
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-block"
            >
              View Social Graph
            </Link>
            <Link 
              href="/api/socialgraph?update=true" 
              className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded inline-block"
            >
              Force Graph Update
            </Link>
          </div>

          {/* Overall Status */}
          <div className="bg-white shadow-md rounded p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Diagnosis Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded ${results.results.api.status === 'success' ? 'bg-green-100' : results.results.api.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <h3 className="font-medium">API Status</h3>
                <p className={`${getStatusColor(results.results.api.status)}`}>{results.results.api.message}</p>
              </div>
              <div className={`p-4 rounded ${results.results.files.status === 'success' ? 'bg-green-100' : results.results.files.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <h3 className="font-medium">Files Status</h3>
                <p className={`${getStatusColor(results.results.files.status)}`}>{results.results.files.message}</p>
              </div>
              <div className={`p-4 rounded ${results.results.data.status === 'success' ? 'bg-green-100' : results.results.data.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <h3 className="font-medium">Data Status</h3>
                <p className={`${getStatusColor(results.results.data.status)}`}>{results.results.data.message}</p>
              </div>
            </div>
          </div>

          {/* Client Status */}
          <div className="bg-white shadow-md rounded p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Client-side Diagnosis</h2>
            <div className={`p-4 rounded ${clientChecks.status === 'success' ? 'bg-green-100' : clientChecks.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <h3 className="font-medium">Browser Status</h3>
              <p className={`${getStatusColor(clientChecks.status)}`}>{clientChecks.message || 'Checking...'}</p>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">API Check</h3>
                <p>Status: {clientChecks.details.apiStatus || 'Unknown'}</p>
                {clientChecks.details.apiMessage && <p>Message: {clientChecks.details.apiMessage}</p>}
                {clientChecks.details.nodeCount !== undefined && <p>Nodes: {clientChecks.details.nodeCount}</p>}
                {clientChecks.details.linkCount !== undefined && <p>Links: {clientChecks.details.linkCount}</p>}
              </div>
              <div>
                <h3 className="font-medium mb-2">SVG Check</h3>
                <p>SVG Exists: {clientChecks.details.svgExists ? 'Yes' : 'No'}</p>
                {clientChecks.details.svgDimensions && (
                  <p>Dimensions: {clientChecks.details.svgDimensions.width} x {clientChecks.details.svgDimensions.height}</p>
                )}
                {clientChecks.details.nodeCount !== undefined && <p>Rendered Nodes: {clientChecks.details.nodeCount}</p>}
                {clientChecks.details.linkCount !== undefined && <p>Rendered Links: {clientChecks.details.linkCount}</p>}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white shadow-md rounded p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Recommendations</h2>
            <ul className="list-disc pl-5 space-y-2">
              {results.recommendations.map((rec: string, index: number) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>

          {/* File Details */}
          {results.results.files.details && (
            <div className="bg-white shadow-md rounded p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">File System Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Property</th>
                      <th className="py-2 px-4 border-b text-left">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-4 border-b">Data Directory</td>
                      <td className="py-2 px-4 border-b">{results.results.files.details.directoryExists ? 'Exists' : 'Missing'}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 border-b">social-graph.json</td>
                      <td className="py-2 px-4 border-b">
                        {results.results.files.details.socialGraphExists ? 'Exists' : 'Missing'}{' '}
                        {results.results.files.details.socialGraphValid === false && '(Invalid JSON)'}
                      </td>
                    </tr>
                    {results.results.files.details.socialGraphExists && (
                      <>
                        <tr>
                          <td className="py-2 px-4 border-b">File Size</td>
                          <td className="py-2 px-4 border-b">{Math.round(results.results.files.details.socialGraphSize / 1024)} KB</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-4 border-b">Last Modified</td>
                          <td className="py-2 px-4 border-b">{new Date(results.results.files.details.socialGraphModified).toLocaleString()}</td>
                        </tr>
                        {results.results.files.details.socialGraphValid && (
                          <>
                            <tr>
                              <td className="py-2 px-4 border-b">Nodes Count</td>
                              <td className="py-2 px-4 border-b">{results.results.files.details.nodesCount}</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-4 border-b">Links Count</td>
                              <td className="py-2 px-4 border-b">{results.results.files.details.linksCount}</td>
                            </tr>
                          </>
                        )}
                      </>
                    )}
                    <tr>
                      <td className="py-2 px-4 border-b">known-pubkeys.json</td>
                      <td className="py-2 px-4 border-b">
                        {results.results.files.details.knownPubkeysExists ? 'Exists' : 'Missing'}{' '}
                        {results.results.files.details.knownPubkeysValid === false && '(Invalid JSON)'}
                      </td>
                    </tr>
                    {results.results.files.details.knownPubkeysExists && results.results.files.details.knownPubkeysValid && (
                      <tr>
                        <td className="py-2 px-4 border-b">Pubkeys Count</td>
                        <td className="py-2 px-4 border-b">{results.results.files.details.pubkeysCount}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Data Details */}
          {results.results.data.details && results.results.data.details.sampleNodes && (
            <div className="bg-white shadow-md rounded p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Data Sample</h2>
              <h3 className="font-medium mb-2">Node Type Distribution</h3>
              {results.results.data.details.nodeTypeDistribution && (
                <ul className="list-disc pl-5 mb-4">
                  {Object.entries(results.results.data.details.nodeTypeDistribution).map(([type, count]: [string, any]) => (
                    <li key={type}>{type}: {count}</li>
                  ))}
                </ul>
              )}
              <h3 className="font-medium mb-2">Sample Nodes (First 3)</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs">
                {JSON.stringify(results.results.data.details.sampleNodes, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw Results (Collapsed) */}
          <details className="bg-white shadow-md rounded p-6 mb-6">
            <summary className="text-xl font-semibold cursor-pointer">Raw Diagnostic Data</summary>
            <pre className="mt-4 bg-gray-100 p-4 rounded overflow-x-auto text-xs h-64">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
} 